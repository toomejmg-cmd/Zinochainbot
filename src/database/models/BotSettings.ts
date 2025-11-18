import mongoose, { Schema, Document } from 'mongoose';

export interface IBotSettings extends Document {
  tradingEnabled: boolean;
  maintenanceMode: boolean;
  tradingFeePercent: number;
  referralFeePercent: number;
  withdrawalWalletAddress?: string;
  withdrawalFeePercentage: number;
  minWithdrawalAmount: number;
  maxWithdrawalAmount?: number;
  dailyWithdrawalLimit?: number;
  monthlyWithdrawalLimit?: number;
  withdrawalRequiresApproval: boolean;
  autoWithdrawalThreshold?: number;
  dailyTradeLimitPerUser?: number;
  maxActiveOrdersPerUser: number;
  tradeCooldownSeconds: number;
  maxTradeSizePerTransaction?: number;
  adminIpWhitelist?: string[];
  require2fa: boolean;
  suspiciousActivityThreshold: number;
  autoLockSuspiciousAccounts: boolean;
  maxFailedLoginAttempts: number;
  solanaRpcEndpoint: string;
  solanaBackupRpcEndpoint?: string;
  ethereumRpcEndpoint?: string;
  bscRpcEndpoint?: string;
  apiRateLimitPerMinute: number;
  autoCollectFees: boolean;
  autoCollectScheduleHours: number;
  minBalanceForAutoCollect: number;
  feeCollectionWalletRotation: boolean;
  maxWalletsPerUser: number;
  requireKycAboveLimit?: number;
  newUserCooldownHours: number;
  allowNewRegistrations: boolean;
  globalMaxSlippageBps: number;
  globalMinSlippageBps: number;
  maxGasPriceGwei?: number;
  enableMevProtection: boolean;
  minPriorityFeeLamports: number;
  maxPriorityFeeLamports: number;
  adminNotificationEmail?: string;
  adminNotificationTelegramId?: number;
  notifyOnLargeTrades: boolean;
  largeTradeThresholdSol: number;
  notifyOnSuspiciousActivity: boolean;
  emergencyStop: boolean;
  emergencyStopReason?: string;
  lastHealthCheck?: Date;
  autoRestartOnError: boolean;
  maxConsecutiveErrors: number;
  createdAt: Date;
  updatedAt: Date;
}

const BotSettingsSchema = new Schema<IBotSettings>({
  tradingEnabled: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  tradingFeePercent: { type: Number, default: 0.5 },
  referralFeePercent: { type: Number, default: 0.1 },
  withdrawalWalletAddress: { type: String, default: null },
  withdrawalFeePercentage: { type: Number, default: 0.10 },
  minWithdrawalAmount: { type: Number, default: 0.01 },
  maxWithdrawalAmount: { type: Number, default: null },
  dailyWithdrawalLimit: { type: Number, default: null },
  monthlyWithdrawalLimit: { type: Number, default: null },
  withdrawalRequiresApproval: { type: Boolean, default: false },
  autoWithdrawalThreshold: { type: Number, default: null },
  dailyTradeLimitPerUser: { type: Number, default: null },
  maxActiveOrdersPerUser: { type: Number, default: 10 },
  tradeCooldownSeconds: { type: Number, default: 0 },
  maxTradeSizePerTransaction: { type: Number, default: null },
  adminIpWhitelist: { type: [String], default: [] },
  require2fa: { type: Boolean, default: false },
  suspiciousActivityThreshold: { type: Number, default: 100.0 },
  autoLockSuspiciousAccounts: { type: Boolean, default: false },
  maxFailedLoginAttempts: { type: Number, default: 5 },
  solanaRpcEndpoint: { type: String, default: 'https://api.devnet.solana.com' },
  solanaBackupRpcEndpoint: { type: String, default: null },
  ethereumRpcEndpoint: { type: String, default: null },
  bscRpcEndpoint: { type: String, default: null },
  apiRateLimitPerMinute: { type: Number, default: 60 },
  autoCollectFees: { type: Boolean, default: false },
  autoCollectScheduleHours: { type: Number, default: 24 },
  minBalanceForAutoCollect: { type: Number, default: 1.0 },
  feeCollectionWalletRotation: { type: Boolean, default: false },
  maxWalletsPerUser: { type: Number, default: 5 },
  requireKycAboveLimit: { type: Number, default: null },
  newUserCooldownHours: { type: Number, default: 0 },
  allowNewRegistrations: { type: Boolean, default: true },
  globalMaxSlippageBps: { type: Number, default: 5000 },
  globalMinSlippageBps: { type: Number, default: 10 },
  maxGasPriceGwei: { type: Number, default: null },
  enableMevProtection: { type: Boolean, default: true },
  minPriorityFeeLamports: { type: Number, default: 1000 },
  maxPriorityFeeLamports: { type: Number, default: 1000000 },
  adminNotificationEmail: { type: String, default: null },
  adminNotificationTelegramId: { type: Number, default: null },
  notifyOnLargeTrades: { type: Boolean, default: true },
  largeTradeThresholdSol: { type: Number, default: 10.0 },
  notifyOnSuspiciousActivity: { type: Boolean, default: true },
  emergencyStop: { type: Boolean, default: false },
  emergencyStopReason: { type: String, default: null },
  lastHealthCheck: { type: Date, default: null },
  autoRestartOnError: { type: Boolean, default: true },
  maxConsecutiveErrors: { type: Number, default: 10 }
}, {
  timestamps: true
});

export const BotSettings = mongoose.model<IBotSettings>('BotSettings', BotSettingsSchema);
