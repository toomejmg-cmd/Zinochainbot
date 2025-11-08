import { InlineKeyboard } from 'grammy';

export function getMainMenu(currentChain?: 'solana' | 'ethereum' | 'bsc'): InlineKeyboard {
  const chainEmoji = currentChain === 'ethereum' ? '🔷' : currentChain === 'bsc' ? '🟡' : '⚡';
  const chainName = currentChain === 'ethereum' ? 'Ethereum' : currentChain === 'bsc' ? 'BSC' : 'Solana';
  
  return new InlineKeyboard()
    .text(`${chainEmoji} Switch Chain (${chainName})`, 'menu_switch_chain')
    .row()
    .text('💰 Buy', 'menu_buy').text('💸 Sell', 'menu_sell')
    .row()
    .text('⏰ Limit Orders', 'menu_limit').text('🔄 DCA Orders', 'menu_dca')
    .row()
    .text('🎯 Sniper', 'menu_sniper').text('👥 Refer Friends', 'menu_referral')
    .row()
    .text('💼 Portfolio', 'menu_portfolio').text('📤 Withdraw', 'menu_withdraw')
    .row()
    .text('🔔 Alerts', 'menu_alerts').text('🎁 Rewards', 'menu_rewards')
    .row()
    .text('⚙️ Settings', 'menu_settings').text('❓ Help', 'menu_help')
    .row()
    .text('🔄 Refresh', 'menu_refresh');
}

export function getChainSelectorMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚡ Solana', 'switch_chain_solana').row()
    .text('🔷 Ethereum', 'switch_chain_ethereum').row()
    .text('🟡 Binance Smart Chain', 'switch_chain_bsc').row()
    .text('🏠 Main Menu', 'menu_main');
}

export function getBackToMainMenu(): InlineKeyboard {
  return new InlineKeyboard().text('🏠 Main Menu', 'menu_main');
}

export function getBuyMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 Quick Buy USDC', 'buy_usdc')
    .row()
    .text('📝 Custom Token', 'buy_custom')
    .row()
    .text('🏠 Main Menu', 'menu_main');
}

export function getSellMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💵 Sell USDC', 'sell_usdc')
    .row()
    .text('📝 Custom Token', 'sell_custom')
    .row()
    .text('🏠 Main Menu', 'menu_main');
}

export function getSettingsMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⚡ Slippage', 'settings_slippage')
    .row()
    .text('🔔 Notifications', 'settings_notifications')
    .row()
    .text('✅ Auto-Approve', 'settings_auto_approve')
    .row()
    .text('🏠 Main Menu', 'menu_main');
}

export function getAdminMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 View Stats', 'admin_stats')
    .row()
    .text('💰 Set Fee', 'admin_setfee')
    .row()
    .text('👥 Manage Admins', 'admin_manage')
    .row()
    .text('🏠 Main Menu', 'menu_main');
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
    .text('🏠 Main Menu', 'menu_main');
}
