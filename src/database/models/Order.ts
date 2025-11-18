import mongoose, { Schema, Document } from 'mongoose';

export interface IOrder extends Document {
  walletId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderType: string;
  fromToken?: string;
  toToken?: string;
  amount?: number;
  targetPrice?: number;
  status: string;
  createdAt: Date;
  executedAt?: Date;
}

const OrderSchema = new Schema<IOrder>({
  walletId: {
    type: Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  orderType: {
    type: String,
    required: true,
    enum: ['limit_buy', 'limit_sell', 'stop_loss', 'take_profit']
  },
  fromToken: { type: String, default: null },
  toToken: { type: String, default: null },
  amount: { type: Number, default: null },
  targetPrice: { type: Number, default: null },
  status: {
    type: String,
    default: 'active',
    enum: ['active', 'executed', 'cancelled', 'expired']
  },
  executedAt: { type: Date, default: null }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
