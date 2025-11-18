import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  chain: string;
  walletType: string;
  publicKey: string;
  encryptedPrivateKey: string;
  isActive: boolean;
  createdAt: Date;
}

const WalletSchema = new Schema<IWallet>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  chain: {
    type: String,
    required: true,
    default: 'solana',
    enum: ['solana', 'ethereum', 'bsc']
  },
  walletType: {
    type: String,
    required: true,
    default: 'generated',
    enum: ['generated', 'imported']
  },
  publicKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  encryptedPrivateKey: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

WalletSchema.index({ userId: 1, chain: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
WalletSchema.index({ userId: 1, publicKey: 1 }, { unique: true });

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
