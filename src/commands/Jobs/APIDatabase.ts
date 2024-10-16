import { Client, TextChannel, Role, Message, EmbedBuilder, PartialMessage, ThreadChannel, ChannelType } from 'discord.js';
import { DatabaseError } from '@lib/types/errors';
import { CHANNELS, DB, ROLES, GUILDS } from '@root/config';
import { SageUser } from '@lib/types/SageUser';
import { calcNeededExp } from '@lib/utils/generalUtils';


// async function storePref(msg: Message) {
// 	const bot = msg.client;
// 	bot.mongo.collection(DB.USERS).findOneAndUpdate(
// 		{discordID: msg.author.id},
// 		{$inc: {count: countInc, curExp: -1}},

// 	)
// 	return result.ops[0];
// }


async function storePref(msg: Message, preferences: Record<string, any>): Promise<void> {
	const bot = msg.client;
	await bot.mongo.collection(DB.USERS).findOneAndUpdate(
		{ discordID: msg.author.id },
		{ $set: { preferences } },
		{ upsert: true }
	);
}
async function reg(bot: Client): Promise<void> {
	bot.on('guildMemberAdd', async (member) => {
		const defaultPref = {
			jobType: 'internship',
			location: 'hybrid',
			keywords: ['coding'],
			frequency: 'daily'
		};
		const messageHolder: Partial<Message> = {
			client: bot,
			author: member.user
		} as Message;
		await storePref(messageHolder as Message, defaultPref);
	});
}
export default reg;
