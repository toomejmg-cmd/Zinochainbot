import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  walletId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  transactionType: string;
  signature?: string;
  fromToken?: string;
  toToken?: string;
  fromAmount?: number;
  toAmount?: number;
  feeAmount: number;
  status: string;
  errorMessage?: string;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
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
  transactionType: {
    type: String,
    required: true,
    enum: ['buy', 'sell', 'transfer', 'withdraw', 'deposit']
  },
  signature: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  fromToken: { type: String, default: null },
  toToken: { type: String, default: null },
  fromAmount: { type: Number, default: null },
  toAmount: { type: Number, default: null },
  feeAmount: { type: Number, default: 0 },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'confirmed', 'failed']
  },
  errorMessage: { type: String, default: null }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
