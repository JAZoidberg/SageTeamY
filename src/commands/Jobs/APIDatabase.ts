// import { Client, User, TextChannel, Role, Message, EmbedBuilder, PartialMessage, ThreadChannel, ChannelType } from 'discord.js';
// import { DatabaseError } from '@lib/types/errors';
// import { CHANNELS, DB, ROLES, GUILDS } from '@root/config';
// import { SageUser } from '@lib/types/SageUser';
// import { calcNeededExp } from '@lib/utils/generalUtils';


// // async function storePref(msg: Message) {
// // 	const bot = msg.client;
// // 	bot.mongo.collection(DB.USERS).findOneAndUpdate(
// // 		{discordID: msg.author.id},
// // 		{$inc: {count: countInc, curExp: -1}},

// // 	)
// // 	return result.ops[0];
// // }

// // interface Job {
// // 	name: Message
// // }
// // const jobs = Message;


// -------------------------Code I may need-------------------Do Not Delete Yet----------------------
// interface Jobs {
// 	jobType: string,
// 	location: string,
// 	keywords: [string],
// 	frequency: string;
// }

// function createMessage(bot:Client, user: User): Message {
// 	return {
// 		client: bot,
// 		author: user,
// 		content: '',
// 		channel: null
// 	} as unknown as Message;
// }
// async function storePref(msg: Message, preferences: Jobs): Promise<void> {
// 	const bot = msg.client;
// 	await bot.mongo.collection(DB.USERS).findOneAndUpdate(
// 		{ discordID: msg.author.id },
// 		{ $set: { preferences } },
// 		{ upsert: true }
// 	);
// }
// async function reg(bot: Client): Promise<void> {
// 	bot.on('guildMemberAdd', async (member) => {
// 		const defaultPref: Jobs = {
// 			jobType: 'internship',
// 			location: 'hybrid',
// 			keywords: ['coding'],
// 			frequency: 'daily'
// 		};
// 		const messageHolder = createMessage(bot, member.user);
// 		await storePref(messageHolder, defaultPref);
// 	});
// }
// export default reg;

import { Client, User, Message } from 'discord.js';
import { DB } from '@root/config';

interface Jobs {
	jobType: string;
	location: string;
	keywords: string[];
	frequency: string;
}

async function storePref(msg: Message, preferences: Jobs): Promise<void> {
	const bot = msg.client;
	await bot.mongo.collection(DB.USERS).findOneAndUpdate(
		{ discordID: msg.author.id },
		{ $set: { preferences } },
		{ upsert: true }
	);
}

async function handleFormSubmission(msg: Message) {
	const args = msg.content.split(',').map(arg => arg.trim());
	if (args.length < 4) {
		return msg.reply('Please provide all preferences: jobType, location, keywords (comma-separated), frequency.');
	}

	const [jobType, location, keywordsRaw, frequency] = args;
	const keywords = keywordsRaw.split(' ').filter(Boolean);

	const preferences: Jobs = {
		jobType,
		location,
		keywords,
		frequency
	};

	await storePref(msg, preferences);
	msg.reply('Your preferences have been updated!');
}

async function reg(bot: Client): Promise<void> {
	bot.on('messageCreate', async (msg: Message) => {
		if (msg.content.startsWith('!setPreferences')) {
			await handleFormSubmission(msg);
		}
	});

	bot.on('guildMemberAdd', async (member) => {
		const defaultPref: Jobs = {
			jobType: 'internship',
			location: 'hybrid',
			keywords: ['coding'],
			frequency: 'daily'
		};
		await storePref(createMessage(bot, member.user), defaultPref);
	});
}

function createMessage(bot: Client, user: User): Message {
	return {
		client: bot,
		author: user,
		content: '',
		channel: null
	} as unknown as Message;
}

export default reg;

