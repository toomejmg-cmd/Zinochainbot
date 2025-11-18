import mongoose, { Schema, Document } from 'mongoose';

export interface IDCAJob extends Document {
  walletId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  fromToken?: string;
  toToken?: string;
  amount?: number;
  frequency: string;
  nextExecution?: Date;
  isActive: boolean;
  createdAt: Date;
}

const DCAJobSchema = new Schema<IDCAJob>({
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
  fromToken: { type: String, default: null },
  toToken: { type: String, default: null },
  amount: { type: Number, default: null },
  frequency: {
    type: String,
    required: true,
    enum: ['hourly', 'daily', 'weekly', 'monthly']
  },
  nextExecution: { type: Date, default: null },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const DCAJob = mongoose.model<IDCAJob>('DCAJob', DCAJobSchema);
