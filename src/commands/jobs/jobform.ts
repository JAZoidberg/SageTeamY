import { Command } from '@root/src/lib/types/Command';
import {
	ChatInputCommandInteraction,
	DMChannel,
	Message
} from 'discord.js';
import { validatePreferences } from '../../lib/utils/jobUtils/validatePreferences';
import { DB, BOT } from '@root/config';
import { MongoClient } from 'mongodb';
import { JobPreferences } from '@root/src/lib/types/JobPreferences';

// All questions in sequence
const questions = [
	'What city do you want to be located?',
	'Remote, hybrid, and/or in-person?',
	'Full time, Part time, and/or Internship?',
	'How far are you willing to travel? (in miles)',
	'Interest 1',
	'Interest 2',
	'Interest 3',
	'Interest 4',
	'Interest 5'
];

export default class JobFormDM extends Command {

	name = 'jobform';
	description = 'Starts a job preferences form via direct message.';
	options = [];

	async run(interaction: ChatInputCommandInteraction) {
		const dm = await interaction.user.createDM();
		await interaction.reply({
			content: 'I’ve sent you a DM with the job form questions.',
			flags: 64
		});
		this.collectAnswers(dm, interaction.user.id);
	}

	private async collectAnswers(channel: DMChannel, userId: string) {
		const answers: string[] = [];
		let current = 0;

		// Send commands overview
		await channel.send(
			'Welcome to the job form!\n' +
      'Type **skip** to skip a question, **back** to return to the previous one.'
		);

		const ask = () =>
			channel.send(`**Question ${current + 1}/${questions.length}:** ${questions[current]}`);

		const collector = channel.createMessageCollector({
			filter: m => m.author.id === userId,
			idle: 5 * 60 * 1000
		});

		collector.on('collect', async msg => {
			const content = msg.content.trim();

			if (content.toLowerCase() === 'skip') {
				answers[current] = '';
			} else if (content.toLowerCase() === 'back') {
				if (current > 0) current--;
				return ask();
			} else {
				answers[current] = content;
				// Validate formatting immediately
				const { isValid, errors } = validatePreferences(answers, 0, true);
				if (!isValid) {
					// Show errors and re-ask same question
					await channel.send(`**Formatting error:**\n${errors.join('\n')}`);
					answers[current] = '';
					return ask();
				}
			}

			// Move on or finish
			if (current < questions.length - 1) {
				current++;
				ask();
			} else {
				collector.stop('completed');
			}
		});

		collector.on('end', async (_collected, reason) => {
			if (reason !== 'completed') {
				await channel.send('Form timed out. Please run `/jobform` again to restart.');
				return;
			}

			// Final validation
			const { isValid, errors } = validatePreferences(answers, 0, true);
			if (!isValid) {
				await channel.send(`Form validation failed:\n${errors.join('\n')}`);
				return;
			}

			// Persist into Mongo
			const client = await MongoClient.connect(DB.CONNECTION, { useUnifiedTopology: true });
			const users = client.db(BOT.NAME).collection(DB.USERS);
			const result = await users.updateOne(
				{ discordId: userId },
				{ $set: { jobPreferences: { answers } } },
				{ upsert: true }
			);

			await channel.send(
				`${`✅ Preferences saved! ` +
        `matched=${result.matchedCount}, modified=${result.modifiedCount}`}${
					result.upsertedId ? `, created new record` : ''}`
			);
		});

		// Kick off the first question
		ask();
	}

}
