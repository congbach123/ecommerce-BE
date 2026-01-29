import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order } from './order.entity';

@Entity('shipping_addresses')
export class ShippingAddress {
  @PrimaryColumn('varchar', { length: 36 })
  id: string;

  @Index('idx_order')
  @Column({ type: 'varchar', length: 36 })
  order_id: string;

  @Column({ type: 'varchar', length: 100 })
  first_name: string;

  @Column({ type: 'varchar', length: 100 })
  last_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255 })
  address_line1: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_line2: string | null;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postal_code: string | null;

  @Column({ type: 'varchar', length: 100 })
  country: string;

  @CreateDateColumn()
  created_at: Date;

  // Relationships
  @OneToOne(() => Order, (order) => order.shipping_address, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
