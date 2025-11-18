import mongoose, { Schema, Document } from 'mongoose';

export interface IWatchlistToken extends Document {
  userId: mongoose.Types.ObjectId;
  chain: string;
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  sourceUrl?: string;
  metadata?: any;
  addedAt: Date;
}

const WatchlistTokenSchema = new Schema<IWatchlistToken>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  chain: {
    type: String,
    required: true,
    enum: ['solana', 'ethereum', 'bsc'],
    index: true
  },
  tokenAddress: {
    type: String,
    required: true
  },
  tokenName: { type: String, default: null },
  tokenSymbol: { type: String, default: null },
  sourceUrl: { type: String, default: null },
  metadata: { type: Schema.Types.Mixed, default: null },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

WatchlistTokenSchema.index({ userId: 1, chain: 1, tokenAddress: 1 }, { unique: true });
WatchlistTokenSchema.index({ userId: 1, chain: 1 });

export const WatchlistToken = mongoose.model<IWatchlistToken>('WatchlistToken', WatchlistTokenSchema);
