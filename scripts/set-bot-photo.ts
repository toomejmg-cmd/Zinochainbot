import dotenv from 'dotenv';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

dotenv.config();

async function setBotProfilePhoto() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in environment');
    process.exit(1);
  }

  const photoPath = path.join(__dirname, '../assets/zinobot-profile.png');
  
  if (!fs.existsSync(photoPath)) {
    console.error(`❌ Profile photo not found at: ${photoPath}`);
    process.exit(1);
  }

  console.log('📸 Setting bot profile photo...');

  try {
    const form = new FormData();
    form.append('photo', fs.createReadStream(photoPath));

    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/setMyProfilePhoto`,
      form,
      {
        headers: form.getHeaders()
      }
    );

    if (response.data.ok) {
      console.log('✅ Bot profile photo set successfully!');
      console.log('🎉 Your bot now has a branded profile picture');
    } else {
      console.error('❌ Failed to set profile photo:', response.data.description);
    }
  } catch (error: any) {
    console.error('❌ Error setting profile photo:', error.response?.data || error.message);
  }
}

setBotProfilePhoto();
