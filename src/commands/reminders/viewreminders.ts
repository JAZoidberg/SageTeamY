import { DB } from '@root/config';
import { Reminder } from '@lib/types/Reminder';
import {
	ChatInputCommandInteraction,
	EmbedBuilder,
	InteractionResponse
} from 'discord.js';
import { reminderTime } from '@root/src/lib/utils/generalUtils';
import { Command } from '@lib/types/Command';

export default class extends Command {

	description = 'See your upcoming reminders.';
	extendedHelp =
	'Don\'t worry, private reminders will be hidden if you use this command publicly.';

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<InteractionResponse<boolean> | void> {
		const reminders: Array<Reminder> = await interaction.client.mongo
			.collection(DB.REMINDERS)
			.find({ owner: interaction.user.id })
			.toArray();

		if (reminders.length < 1) {
			return interaction.reply({
				content: 'You don\'t have any pending reminders!',
				ephemeral: true
			});
		}

		// Split reminders
		const jobReminders = reminders.filter(r => r.content === 'Job Reminder');
		const normalReminders = reminders.filter(r => r.content !== 'Job Reminder');

		// Sort job reminders by filter priority
		const priorityOrder = { salary: 1, date: 2, relevance: 3, default: 4 };
		jobReminders.sort((a, b) => {
			const aVal = priorityOrder[a.filterBy || 'default'];
			const bVal = priorityOrder[b.filterBy || 'default'];
			return aVal - bVal;
		});

		// Sort regular reminders by expiration
		normalReminders.sort((a, b) => a.expires.valueOf() - b.expires.valueOf());

		const sortedReminders = [...jobReminders, ...normalReminders];
		const embeds: Array<EmbedBuilder> = [];

		sortedReminders.forEach((reminder, i) => {
			if (i % 25 === 0) {
				embeds.push(
					new EmbedBuilder()
						.setTitle('📋 Pending Reminders')
						.setColor('DarkAqua')
				);
			}

			const hidden = reminder.mode === 'private';

			let name = `${i + 1}. `;
			if (hidden) {
				name += reminder.content === 'Job Reminder' ? '[Job Reminder]' : 'Private reminder';
			} else {
				name += reminder.content;
			}

			let value = hidden
				? `This is a **${reminder.repeat}** job reminder`
				: reminderTime(reminder);

			if (reminder.filterBy) {
				value += `\n🔍 Sorting preference: **${reminder.filterBy}**`;
			}

			embeds[Math.floor(i / 25)].addFields({ name, value });
		});

		// Set sorting explanation at the top
		if (embeds.length > 0) {
			embeds[0].setDescription('Job reminders are sorted based on your selected filter type.');
		}

		// Add sorting logic at the bottom
		embeds[embeds.length - 1].addFields({
			name: '\u200B',
			value: '**Job Reminder Sorting:** salary > date > relevance > default'
		});

		return interaction.reply({ embeds });
	}

}
