import mongoose, { Schema, Document } from 'mongoose';

export interface IFeesCollected extends Document {
  transactionId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  feeAmount: number;
  feeType: string;
  tokenMint?: string;
  createdAt: Date;
}

const FeesCollectedSchema = new Schema<IFeesCollected>({
  transactionId: {
    type: Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  feeAmount: {
    type: Number,
    required: true
  },
  feeType: {
    type: String,
    default: 'trading',
    enum: ['trading', 'withdrawal', 'transfer']
  },
  tokenMint: { type: String, default: null }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const FeesCollected = mongoose.model<IFeesCollected>('FeesCollected', FeesCollectedSchema);
