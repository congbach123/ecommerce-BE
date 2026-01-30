# Ecommerce Backend

NestJS API for the Baccon Store ecommerce platform.

## Tech Stack

- **Framework:** NestJS
- **Database:** MySQL with TypeORM
- **Auth:** JWT with refresh tokens
- **Payments:** Stripe
- **Storage:** Cloudinary

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure .env with your values
# (see Environment Variables section)

# Run in development
npm run start:dev
```

### Environment Variables

```bash
# Database
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=ecommerce
DB_USERNAME=root
DB_PASSWORD=yourpassword
DB_SYNCHRONIZE=true

# JWT
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3002
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| GET | `/auth/me` | Get current user |
| POST | `/auth/refresh` | Refresh tokens |
| POST | `/auth/logout` | Logout |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List products |
| GET | `/products/:slug` | Get product by slug |
| POST | `/products` | Create product [Admin] |
| PUT | `/products/:id` | Update product [Admin] |
| DELETE | `/products/:id` | Delete product [Admin] |

### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products/:id/reviews` | Get product reviews |
| GET | `/products/:id/reviews/stats` | Get review stats |
| POST | `/products/:id/reviews` | Create review [Auth] |
| DELETE | `/reviews/:id` | Delete review [Auth] |

### Wishlist
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wishlist` | Get wishlist [Auth] |
| POST | `/wishlist/:productId` | Add to wishlist [Auth] |
| DELETE | `/wishlist/:productId` | Remove [Auth] |
| POST | `/wishlist/:productId/move-to-cart` | Move to cart [Auth] |

### Cart
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cart` | Get cart |
| POST | `/cart/items` | Add item |
| PUT | `/cart/items/:id` | Update quantity |
| DELETE | `/cart/items/:id` | Remove item |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders` | Create order |
| GET | `/orders` | List user orders |
| GET | `/orders/:id` | Get order detail |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard/stats` | Dashboard statistics |
| GET | `/admin/orders` | All orders |
| PUT | `/admin/orders/:id/status` | Update order status |
| GET | `/admin/users` | All users |

## Deployment

### Railway

1. Create new project in Railway
2. Add MySQL database
3. Configure environment variables
4. Connect GitHub repository
5. Deploy

```bash
# Build for production
npm run build

# Start production server
npm run start:prod
```

## Scripts

```bash
npm run start:dev    # Development with hot reload
npm run build        # Build for production
npm run start:prod   # Run production build
npm run lint         # Run ESLint
npm run test         # Run tests
```
