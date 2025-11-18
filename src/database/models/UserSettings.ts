import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSettings extends Document {
  userId: mongoose.Types.ObjectId;
  slippageBps: number;
  notificationsEnabled: boolean;
  autoApproveTrades: boolean;
  priorityFeeMode: string;
  maxTradeAmount?: number;
  defaultBuyAmount: number;
  tradingMode: string;
  aiRiskLevel: string;
  aiMaxTradeSize: number;
  aiDailyBudget: number;
  aiStopLossPercent: number;
  aiStrategy: string;
  aiRequireConfirmation: string;
  aiShowReasoning: boolean;
  mevProtection: boolean;
  antiRugDetection: boolean;
  transactionConfirmations: string;
  walletBackupReminder: string;
  tradeAlerts: boolean;
  priceAlerts: boolean;
  aiTradeAlerts: boolean;
  referralAlerts: boolean;
  portfolioSummary: string;
  defaultChain: string;
  currencyDisplay: string;
  hideSmallBalances: boolean;
  language: string;
  customRpcSolana?: string;
  customRpcEthereum?: string;
  customRpcBsc?: string;
  transactionSpeed: string;
  debugMode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSettingsSchema = new Schema<IUserSettings>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  slippageBps: { type: Number, default: 100 },
  notificationsEnabled: { type: Boolean, default: true },
  autoApproveTrades: { type: Boolean, default: false },
  priorityFeeMode: { type: String, default: 'auto' },
  maxTradeAmount: { type: Number, default: null },
  defaultBuyAmount: { type: Number, default: 1.0 },
  tradingMode: { type: String, default: 'manual' },
  aiRiskLevel: { type: String, default: 'balanced' },
  aiMaxTradeSize: { type: Number, default: 1.0 },
  aiDailyBudget: { type: Number, default: 5.0 },
  aiStopLossPercent: { type: Number, default: 20 },
  aiStrategy: { type: String, default: 'balanced' },
  aiRequireConfirmation: { type: String, default: 'large_trades' },
  aiShowReasoning: { type: Boolean, default: true },
  mevProtection: { type: Boolean, default: true },
  antiRugDetection: { type: Boolean, default: true },
  transactionConfirmations: { type: String, default: 'smart' },
  walletBackupReminder: { type: String, default: 'weekly' },
  tradeAlerts: { type: Boolean, default: true },
  priceAlerts: { type: Boolean, default: true },
  aiTradeAlerts: { type: Boolean, default: true },
  referralAlerts: { type: Boolean, default: true },
  portfolioSummary: { type: String, default: 'weekly' },
  defaultChain: { type: String, default: 'solana' },
  currencyDisplay: { type: String, default: 'USD' },
  hideSmallBalances: { type: Boolean, default: false },
  language: { type: String, default: 'en' },
  customRpcSolana: { type: String, default: null },
  customRpcEthereum: { type: String, default: null },
  customRpcBsc: { type: String, default: null },
  transactionSpeed: { type: String, default: 'normal' },
  debugMode: { type: Boolean, default: false }
}, {
  timestamps: true
});

export const UserSettings = mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema);
