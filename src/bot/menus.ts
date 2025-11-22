import { InlineKeyboard } from 'grammy';

export function getMainMenu(currentChain?: 'solana' | 'ethereum' | 'bsc'): InlineKeyboard {
  const chainEmoji = currentChain === 'ethereum' ? '🔷' : currentChain === 'bsc' ? '🟡' : '⚡';
  const chainName = currentChain === 'ethereum' ? 'Ethereum' : currentChain === 'bsc' ? 'BSC' : 'Solana';
  
  return new InlineKeyboard()
    .text(`${chainEmoji} Switch Chain (${chainName})`, 'menu_switch_chain')
    .row()
    .text('👛 Wallet', 'menu_wallet')
    .row()
    .text('💰 Buy', 'menu_buy').text('💸 Sell', 'menu_sell')
    .row()
    .text('⏰ Limit Orders', 'menu_limit').text('🔄 DCA Orders', 'menu_dca')
    .row()
    .text('🎯 Sniper', 'menu_sniper').text('👥 Refer Friends', 'menu_referral')
    .row()
    .text('💼 Portfolio', 'menu_portfolio').text('📤 Withdraw', 'menu_withdraw')
    .row()
    .text('📤 P2P Transfer', 'menu_p2p_transfer').text('🎁 Airdrop', 'menu_airdrop')
    .row()
    .text('🔔 Alerts', 'menu_alerts').text('🎁 Rewards', 'menu_rewards')
    .row()
    .text('👀 Watchlist', 'menu_watchlist').text('⚙️ Settings', 'menu_settings')
    .row()
    .text('❓ Help', 'menu_help').text('🔄 Refresh', 'menu_refresh')
    .row()
    .text('❌ Close', 'close_menu');
}

export function getChainSelectorMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚡ Solana', 'switch_chain_solana').row()
    .text('🔷 Ethereum', 'switch_chain_ethereum').row()
    .text('🟡 Binance Smart Chain', 'switch_chain_bsc').row()
    .text('🔙 Back', 'back').text('❌ Close', 'close_menu');
}

export function getWalletMenu(chain?: 'solana' | 'ethereum' | 'bsc'): InlineKeyboard {
  const explorerName = chain === 'ethereum' ? 'Etherscan' : chain === 'bsc' ? 'BSCScan' : 'Solscan';
  const nativeSymbol = chain === 'ethereum' ? 'ETH' : chain === 'bsc' ? 'BNB' : 'SOL';
  
  return new InlineKeyboard()
    .text(`🔍 View on ${explorerName}`, 'wallet_view_explorer')
    .row()
    .text(`📥 Deposit ${nativeSymbol}`, 'wallet_deposit').text(`💰 Buy ${nativeSymbol}`, 'wallet_buy')
    .row()
    .text(`📤 Withdraw all ${nativeSymbol}`, 'wallet_withdraw_all').text(`📤 Withdraw X ${nativeSymbol}`, 'wallet_withdraw_custom')
    .row()
    .text('🪙 Manage Tokens', 'wallet_manage_tokens').text('📲 Import Wallet', 'wallet_import')
    .row()
    .text('🔄 Reset All Wallets', 'wallet_reset').text('🔑 Export Seed Phrase', 'wallet_export_seed')
    .row()
    .text('🔄 Refresh', 'wallet_refresh')
    .row()
    .text('🔙 Back', 'back').text('❌ Close', 'close_menu');
}

export function getBackToMainMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🏠 Main Menu', 'menu_main')
    .row()
    .text('❌ Close', 'close_menu');
}

export function getBuyMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💳 Buy with Card (Moonpay)', 'buy_moonpay')
    .row()
    .text('📝 Custom Token', 'buy_custom')
    .row()
    .text('🔙 Back', 'back').text('❌ Close', 'close_menu');
}

export function getSellMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💵 Sell USDC', 'sell_usdc')
    .row()
    .text('📝 Custom Token', 'sell_custom')
    .row()
    .text('🔙 Back', 'back').text('❌ Close', 'close_menu');
}

export function getSettingsMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚡ Slippage', 'settings_slippage')
    .row()
    .text('🔔 Notifications', 'settings_notifications')
    .row()
    .text('✅ Auto-Approve', 'settings_auto_approve')
    .row()
    .text('🔙 Back', 'back').text('❌ Close', 'close_menu');
}

export function getAdminMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 View Stats', 'admin_stats')
    .row()
    .text('💰 Set Fee', 'admin_setfee')
    .row()
    .text('👥 Manage Admins', 'admin_manage')
    .row()
    .text('🏠 Main Menu', 'menu_main')
    .row()
    .text('❌ Close', 'close_menu');
}

export function getConfirmMenu(action: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Confirm', `confirm_${action}`)
    .text('❌ Cancel', 'menu_main');
}

export function getWithdrawMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💰 Withdraw SOL', 'withdraw_sol')
    .row()
    .text('🪙 Withdraw Token', 'withdraw_token')
    .row()
    .text('🔙 Back', 'back').text('❌ Close', 'close_menu');
}

export function getPinEntryKeyboard(pinLength: number = 0): InlineKeyboard {
  return new InlineKeyboard()
    .text('1️⃣', 'pin_1').text('2️⃣', 'pin_2').text('3️⃣', 'pin_3')
    .row()
    .text('4️⃣', 'pin_4').text('5️⃣', 'pin_5').text('6️⃣', 'pin_6')
    .row()
    .text('7️⃣', 'pin_7').text('8️⃣', 'pin_8').text('9️⃣', 'pin_9')
    .row()
    .text('0️⃣', 'pin_0').text('⬅️ Delete', 'pin_delete')
    .row()
    .text(`✅ Confirm (${pinLength}/4-6)`, 'pin_confirm')
    .text('❌ Cancel', 'pin_cancel');
}

export function getPinDisplayKeyboard(pinLength: number = 0): InlineKeyboard {
  return new InlineKeyboard()
    .text('1️⃣', 'pin_1').text('2️⃣', 'pin_2').text('3️⃣', 'pin_3')
    .row()
    .text('4️⃣', 'pin_4').text('5️⃣', 'pin_5').text('6️⃣', 'pin_6')
    .row()
    .text('7️⃣', 'pin_7').text('8️⃣', 'pin_8').text('9️⃣', 'pin_9')
    .row()
    .text('0️⃣', 'pin_0').text('⬅️ Delete', 'pin_delete')
    .row()
    .text(`✅ Verify PIN (${pinLength}/4-6)`, 'pin_confirm')
    .text('❌ Cancel', 'pin_cancel');
}

export function getTokenManagementMenu(chain?: 'solana' | 'ethereum' | 'bsc', stats?: {
  solBalance: number;
  tokensOwned: number;
  tokenValue: string;
  frozenTokens: number;
  hiddenMinPosTokens: number;
  manuallyHiddenTokens: number;
}): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔒 Hide Tokens Below Min Pos Value: $0.001', 'tokens_hide_min_value')
    .row()
    .text('🔥 Swap and Burn', 'tokens_swap_burn').text('👁️ Manage Hidden', 'tokens_manage_hidden')
    .row()
    .text('🔙 Back', 'back').text('🔄 Refresh', 'tokens_refresh')
    .row()
    .text('❌ Close', 'close_menu');
}

export function getWatchlistMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Add Token', 'watchlist_add')
    .row()
    .text('📊 View All', 'watchlist_view_all')
    .row()
    .text('🔙 Back', 'back').text('❌ Close', 'close_menu');
}
