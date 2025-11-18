import mongoose, { Schema, Document } from 'mongoose';

export interface IRewardPayoutBatch extends Document {
  triggeredBy: string;
  adminId?: mongoose.Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  totalRewards: number;
  totalUsers: number;
  status: string;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

const RewardPayoutBatchSchema = new Schema<IRewardPayoutBatch>({
  triggeredBy: {
    type: String,
    required: true,
    enum: ['cron', 'admin']
  },
  adminId: {
    type: Schema.Types.ObjectId,
    ref: 'AdminUser',
    default: null
  },
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  totalRewards: {
    type: Number,
    default: 0
  },
  totalUsers: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    required: true,
    default: 'pending',
    enum: ['pending', 'processing', 'completed', 'failed'],
    index: true
  },
  errorMessage: { type: String, default: null },
  completedAt: { type: Date, default: null }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const RewardPayoutBatch = mongoose.model<IRewardPayoutBatch>('RewardPayoutBatch', RewardPayoutBatchSchema);
