import TelegramBot from "node-telegram-bot-api";
import { UserService } from "../services/user.service";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { GRSOLTradeVersion } from "../config";
import { copytoclipboard } from "../utils";
import { TokenService } from "../services/token.metadata";
import { contractInfoScreenHandler } from "./contract.info.screen";

const MAX_RETRIES = 5;
export const welcomeKeyboardList = [
  // [{ text: '🏦 Buy/Sell', command: 'buysell' }],
  // snipe_token, my_position
  [
    { text: "🎯 Sniper [Soon]", command: "dummy_button" },
    { text: "📊 Positions", command: "position" },
  ], // position
  // [{ text: '♻️ Withdraw', command: 'transfer_funds' }],
  [{ text: "Burn: Off ♨️", command: `burn_switch` }],
  [
    { text: "⛓ Bridge", command: "bridge" },
    { text: "🛠 Settings & Tools", command: "settings" },
  ],
  [{ text: "🎁 Referral Program", command: "referral" }],
  [{ text: "❌ Close", command: "dismiss_message" }],
];

export const WelcomeScreenHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  try {
    const { username, id: chat_id, first_name, last_name } = msg.chat;
    // check if bot
    if (!username) {
      bot.sendMessage(
        chat_id,
        "⚠️ You have no telegram username. Please take at least one and try it again."
      );
      return;
    }
    const user = await UserService.findOne({ username });
    // if new user, create one
    if (!user) {
      const res = await newUserHandler(bot, msg);
      if (!res) return;
    }
    // send welcome guide
    await welcomeGuideHandler(bot, msg);
    // await bot.deleteMessage(chat_id, msg.message_id);
  } catch (error) {
    console.log("-WelcomeScreenHandler-", error);
  }
};

const newUserHandler = async (bot: TelegramBot, msg: TelegramBot.Message) => {
  const { username, id: chat_id, first_name, last_name } = msg.chat;

  let retries = 0;
  let userdata: any = null;
  let private_key = "";
  let wallet_address = "";

  // find unique private_key
  do {
    const keypair = Keypair.generate();
    private_key = bs58.encode(keypair.secretKey);
    wallet_address = keypair.publicKey.toString();

    const wallet = await UserService.findOne({ wallet_address });
    if (!wallet) {
      // add
      const newUser = {
        chat_id,
        username,
        first_name,
        last_name,
        wallet_address,
        private_key,
      };
      userdata = await UserService.create(newUser); // true; //
    } else {
      retries++;
    }
  } while (retries < MAX_RETRIES && !userdata);

  // impossible to create
  if (!userdata) {
    await bot.sendMessage(
      chat_id,
      "Sorry, we cannot create your account. Please contact support team"
    );
    return false;
  }

  // send private key & wallet address
  const caption =
    `👋 Welcome to SOL TradeBot, ${msg.chat.first_name || 'friend'}!\n\n` +
    `🎉 A new wallet has been successfully created for you. Below is your wallet address:\n\n` +
    `${wallet_address}\n\n` +
    `<b>⚠️ Please save your private key securely:</b>\n\n` +
    `<tg-spoiler>${private_key}</tg-spoiler>\n\n` +
    `🔰 <b>Important:</b> Losing this key means losing access to your wallet.\n\n` +
    `📘 <b>To get started, check out our <a href="https://docs.grsol.io">documentation</a>.</b>`;

  await bot.sendMessage(chat_id, caption, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "* Dismiss message",
            callback_data: JSON.stringify({
              command: "dismiss_message",
            }),
          },
        ],
      ],
    },
  });
  return true;
};

export const welcomeGuideHandler = async (
  bot: TelegramBot,
  msg: TelegramBot.Message,
  replaceId?: number
) => {
  const { id: chat_id, username } = msg.chat;
  const user = await UserService.findOne({ username });

  if (!user) return;
  const solbalance = await TokenService.getSOLBalance(user.wallet_address);
  const caption =
    `<b>👋 Welcome to SOLTrade, ${msg.chat.first_name || 'friend'}!</b>\n\n` +
    `🚀 The unique Solana trading bot that lets you snipe, trade, and manage your positions with ease.\n\n` +
    `🔹 <b>Innovative Burn Mechanism</b> — unlike anything seen before 🔥\n` +
    `🔹 <b>Revenue Sharing</b> through GRSol ($GRW) buybacks\n\n` +
    `<b>💳 Wallet Address:</b>\n${copytoclipboard(user.wallet_address)}\n\n` +
    `<b>💰 Balance:</b> ${solbalance} SOL\n\n` +
    `<a href="https://solscan.io/address/${user.wallet_address}">🔍 View on Solscan</a>\n\n` +
    `🌐 <b>Part of the <a href="https://grsol.io">GRSol</a> Ecosystem</b>\n\n` +
    // `-----------------------\n` +
    // `<a href="https://docs.grsol.io/docs">📖 Docs</a>\n` +
    // `<a href="https://grsol.io">🌍 Website</a>\n\n` +
    `<b>📥 Paste a contract address to open the Buy/Sell menu, or choose an option below to get started.</b>`;

  // const textEventHandler = async (msg: TelegramBot.Message) => {
  //   const receivedChatId = msg.chat.id;
  //   const receivedText = msg.text;
  //   const receivedMessageId = msg.message_id;
  //   const receivedTextSender = msg.chat.username;
  //   // Check if the received message ID matches the original message ID
  //   if (receivedText && receivedChatId === chat_id) {
  //     // message should be same user
  //     if (receivedTextSender === username) {
  //       await contractInfoScreenHandler(bot, msg, receivedText, 'switch_sell');
  //     }
  //     setTimeout(() => { bot.deleteMessage(receivedChatId, receivedMessageId) }, 2000)
  //   }
  //   console.log("Removed");
  //   bot.removeListener('text', textEventHandler);
  // }

  // // Add the 'text' event listener
  // bot.on('text', textEventHandler);

  const burn_fee = user.burn_fee;
  const reply_markup = {
    inline_keyboard: welcomeKeyboardList.map((rowItem) =>
      rowItem.map((item) => {
        if (item.command.includes("bridge")) {
          return {
            text: item.text,
            url: "https://t.me/grbridge_bot",
          };
        }
        if (item.text.includes("Burn")) {
          const burnText = `${burn_fee ? "Burn: On 🔥" : "Burn: Off ♨️"}`;
          return {
            text: burnText,
            callback_data: JSON.stringify({
              command: item.command,
            }),
          };
        }
        return {
          text: item.text,
          callback_data: JSON.stringify({
            command: item.command,
          }),
        };
      })
    ),
  };

  if (replaceId) {
    bot.editMessageText(caption, {
      message_id: replaceId,
      chat_id,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup,
    });
  } else {
    await bot.sendMessage(chat_id, caption, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup,
    });
  }
};
