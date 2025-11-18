import mongoose, { Schema, Document } from 'mongoose';

export interface ITokenCache extends Document {
  mintAddress: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  priceUsd?: number;
  lastUpdated: Date;
}

const TokenCacheSchema = new Schema<ITokenCache>({
  mintAddress: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  symbol: { type: String, default: null },
  name: { type: String, default: null },
  decimals: { type: Number, default: null },
  priceUsd: { type: Number, default: null },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

export const TokenCache = mongoose.model<ITokenCache>('TokenCache', TokenCacheSchema);
