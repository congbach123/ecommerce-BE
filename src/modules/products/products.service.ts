import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private productImageRepository: Repository<ProductImage>,
    private cloudinaryService: CloudinaryService,
    private categoriesService: CategoriesService,
  ) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const slug = this.generateSlug(createProductDto.name);

    // Check if slug exists
    const existing = await this.productRepository.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(
        `Product with slug "${slug}" already exists`,
      );
    }

    // Check if SKU exists
    if (createProductDto.sku) {
      const existingSku = await this.productRepository.findOne({
        where: { sku: createProductDto.sku },
      });
      if (existingSku) {
        throw new ConflictException(
          `Product with SKU "${createProductDto.sku}" already exists`,
        );
      }
    }

    // Validate category if provided
    if (createProductDto.category_id) {
      await this.categoriesService.findOne(createProductDto.category_id);
    }

    const product = this.productRepository.create({
      ...createProductDto,
      slug,
    });

    return this.productRepository.save(product);
  }

  async findAll(query: QueryProductDto) {
    const {
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      search,
      sort,
      order,
      featured,
    } = query;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.images', 'images')
      .where('product.is_active = :isActive', { isActive: true });

    // Category filter
    if (category) {
      queryBuilder.andWhere('category.slug = :categorySlug', {
        categorySlug: category,
      });
    }

    // Price range filter
    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    // Search filter
    if (search) {
      queryBuilder.andWhere(
        '(product.name LIKE :search OR product.description LIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Featured filter
    if (featured !== undefined) {
      queryBuilder.andWhere('product.is_featured = :featured', { featured });
    }

    // Sorting
    const sortField =
      sort === 'price'
        ? 'product.price'
        : sort === 'name'
          ? 'product.name'
          : 'product.created_at';
    queryBuilder.orderBy(sortField, order);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'images'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { slug, is_active: true },
      relations: ['category', 'images'],
    });

    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found`);
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);

    // Update slug if name changed
    if (updateProductDto.name && updateProductDto.name !== product.name) {
      const newSlug = this.generateSlug(updateProductDto.name);
      const existing = await this.productRepository.findOne({
        where: { slug: newSlug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Product with slug "${newSlug}" already exists`,
        );
      }
      product.slug = newSlug;
    }

    // Check SKU uniqueness if updating
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existingSku = await this.productRepository.findOne({
        where: { sku: updateProductDto.sku },
      });
      if (existingSku && existingSku.id !== id) {
        throw new ConflictException(
          `Product with SKU "${updateProductDto.sku}" already exists`,
        );
      }
    }

    Object.assign(product, updateProductDto);
    return this.productRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);

    // Delete all images from Cloudinary
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        // Extract public_id from URL
        const publicId = this.extractPublicId(image.image_url);
        if (publicId) {
          await this.cloudinaryService.deleteImage(publicId);
        }
      }
    }

    await this.productRepository.remove(product);
  }

  async uploadImage(
    productId: string,
    file: Express.Multer.File,
    altText?: string,
    isPrimary?: boolean,
  ): Promise<ProductImage> {
    const product = await this.findOne(productId);

    // Upload to Cloudinary
    const uploadResult = await this.cloudinaryService.uploadImage(
      file,
      'products',
    );

    // If this is set as primary, unset other primary images
    if (isPrimary) {
      await this.productImageRepository.update(
        { product: { id: productId }, is_primary: true },
        { is_primary: false },
      );
    }

    // Get current max display_order
    const maxOrder = await this.productImageRepository
      .createQueryBuilder('image')
      .where('image.product_id = :productId', { productId })
      .select('MAX(image.display_order)', 'max')
      .getRawOne();

    const displayOrder = (maxOrder?.max || 0) + 1;

    const productImage = this.productImageRepository.create({
      product,
      image_url: uploadResult.secure_url,
      alt_text: altText || product.name,
      is_primary: isPrimary || false,
      display_order: displayOrder,
    });

    return this.productImageRepository.save(productImage);
  }

  async deleteImage(productId: string, imageId: string): Promise<void> {
    const product = await this.findOne(productId);
    const image = await this.productImageRepository.findOne({
      where: { id: imageId, product: { id: productId } },
    });

    if (!image) {
      throw new NotFoundException(`Image not found`);
    }

    // Delete from Cloudinary
    const publicId = this.extractPublicId(image.image_url);
    if (publicId) {
      await this.cloudinaryService.deleteImage(publicId);
    }

    await this.productImageRepository.remove(image);
  }

  private extractPublicId(url: string): string | null {
    // Extract public_id from Cloudinary URL
    // Example: https://res.cloudinary.com/demo/image/upload/v1234567890/ecommerce/products/abc123.jpg
    // Returns: ecommerce/products/abc123
    const matches = url.match(/\/ecommerce\/([^/]+)\/([^/.]+)/);
    return matches ? `ecommerce/${matches[1]}/${matches[2]}` : null;
  }
}
