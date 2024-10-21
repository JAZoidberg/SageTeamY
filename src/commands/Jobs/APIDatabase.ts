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
// --------------------------------------Second attempt---------------------------------------------
// import { Client, User, Message } from 'discord.js';
// import { DB } from '@root/config';

// interface Jobs {
// 	jobType: string;
// 	location: string;
// 	keywords: string[];
// 	frequency: string;
// }

// async function storePref(msg: Message, preferences: Jobs): Promise<void> {
// 	const bot = msg.client;
// 	await bot.mongo.collection(DB.USERS).findOneAndUpdate(
// 		{ discordID: msg.author.id },
// 		{ $set: { preferences } },
// 		{ upsert: true }
// 	);
// }

// async function handleFormSubmission(msg: Message) {
// 	const args = msg.content.split(',').map(arg => arg.trim());
// 	if (args.length < 4) {
// 		return msg.reply('Please provide all preferences: jobType, location, keywords (comma-separated), frequency.');
// 	}

// 	const [jobType, location, keywordsRaw, frequency] = args;
// 	const keywords = keywordsRaw.split(' ').filter(Boolean);

// 	const preferences: Jobs = {
// 		jobType,
// 		location,
// 		keywords,
// 		frequency
// 	};

// 	await storePref(msg, preferences);
// 	msg.reply('Your preferences have been updated!');
// }

// async function reg(bot: Client): Promise<void> {
// 	bot.on('messageCreate', async (msg: Message) => {
// 		if (msg.content.startsWith('!setPreferences')) {
// 			await handleFormSubmission(msg);
// 		}
// 	});

// 	bot.on('guildMemberAdd', async (member) => {
// 		const defaultPref: Jobs = {
// 			jobType: 'internship',
// 			location: 'hybrid',
// 			keywords: ['coding'],
// 			frequency: 'daily'
// 		};
// 		await storePref(createMessage(bot, member.user), defaultPref);
// 	});
// }

// function createMessage(bot: Client, user: User): Message {
// 	return {
// 		client: bot,
// 		author: user,
// 		content: '',
// 		channel: null
// 	} as unknown as Message;
// }

// export default reg;

// --------------------------------third attempt---------------------------------------

import { Client, User, Message } from 'discord.js';
import { DB } from '@root/config';

interface Jobs {
	jobType: string;
	location: string;
	keywords: string[];
	frequency: string;
}

// interface DatabaseResponse {
// 	acknowledged: boolean;
// 	modifiedCount: number;
// 	upsertedId: string | null;
// 	upsertedCount: number;
// 	matchedCount: number;
// }

async function storePref(msg: Message, preferences: Jobs): Promise<void> {
	try {
		const bot = msg.client;
		const result = await bot.mongo.collection(DB.USERS).findOneAndUpdate(
			{ discordID: msg.author.id },
			{
				$set: { preferences },
				$setOnInsert: { createdAt: new Date() }
			},
			{
				upsert: true,
				returnDocument: 'after'
			}
		);

		if (!result) {
			throw new Error('Failed to update preferences');
		}
	} catch (error) {
		console.error('Error storing preferences:', error);
		throw new Error('Failed to save preferences to database');
	}
}

function validatePreferences(args: string[]): Jobs | null {
	if (args.length < 4) {
		return null;
	}

	const [jobType, location, keywordsRaw, frequency] = args;

	// Basic validation
	if (!jobType || !location || !keywordsRaw || !frequency) {
		return null;
	}

	// Convert keywords string to array and filter empty strings
	const keywords = keywordsRaw.split(' ')
		.filter(keyword => keyword.trim().length > 0);

	return {
		jobType: jobType.toLowerCase(),
		location: location.toLowerCase(),
		keywords,
		frequency: frequency.toLowerCase()
	};
}

async function handleFormSubmission(msg: Message): Promise<void> {
	try {
		const args = msg.content.replace('!setPreferences', '')
			.split(',')
			.map(arg => arg.trim());

		const preferences = validatePreferences(args);

		if (!preferences) {
			await msg.reply('Please provide all preferences in the format: !setPreferences jobType, location, keywords (space-separated), frequency');
			return;
		}

		await storePref(msg, preferences);
		await msg.reply('Your preferences have been successfully updated! 👍');
	} catch (error) {
		console.error('Error in form submission:', error);
		await msg.reply('Sorry, there was an error saving your preferences. Please try again later.');
	}
}

async function reg(bot: Client): Promise<void> {
	if (!bot.mongo) {
		throw new Error('MongoDB connection not initialized');
	}

	bot.on('messageCreate', async (msg: Message) => {
		if (msg.author.bot) return; // Ignore bot messages
		if (msg.content.startsWith('!setPreferences')) {
			await handleFormSubmission(msg);
		}
	});

	bot.on('guildMemberAdd', async (member) => {
		try {
			const defaultPref: Jobs = {
				jobType: 'internship',
				location: 'hybrid',
				keywords: ['coding'],
				frequency: 'daily'
			};

			const message = {
				client: bot,
				author: member.user,
				content: '',
				channel: member.guild.systemChannel,
				reply: async (content: string) => {
					if (member.guild.systemChannel) {
						await member.guild.systemChannel.send(`${member.user}: ${content}`);
					}
				}
			} as unknown as Message;

			await storePref(message, defaultPref);
			await message.reply('Welcome! Default job preferences have been set. Use !setPreferences to customize them.');
		} catch (error) {
			console.error('Error setting default preferences:', error);
		}
	});
}

export default reg;
