import { Command } from '@root/src/lib/types/Command';
import {
	ActionRowBuilder,
	ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	InteractionResponse,
	ModalBuilder,
	ModalSubmitFields,
	TextInputBuilder,
	TextInputStyle
} from 'discord.js';

// prettier-ignore
const questions = [
	[
		'What city are you located in?',
		'Are you looking for remote or in person?',
		'Job, internship or both?',
		'How far are you willing to travel?'
	],
	['Interest 1', 'Interest 2', 'Interest 3', 'Interest 4', 'Interest 5']
];

// prettier-ignore
export default class extends Command {

	name: 'jobform';
	description =
	'Form to get your preferences for jobs to be used with the Job Alert System!';

	options: ApplicationCommandOptionData[] = [
		{
			name: 'qset',
			description: 'Which question set do you want to view (1 or 2).',
			type: ApplicationCommandOptionType.Number,
			required: true,
			choices: [
				{ name: 'qset 1', value: 1 },
				{ name: 'qset 2', value: 2 }
			]
		}
	];

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<InteractionResponse<boolean> | void> {
		const questionSet = interaction.options.getNumber('qset') - 1;

		if (questionSet !== 0 && questionSet !== 1) {
			interaction.reply({ content: 'Please enter either 1 or 2' });
			return;
		}

		const modal = new ModalBuilder()
			.setCustomId(`jobModal${questionSet}`)
			.setTitle(`Job Form (${questionSet + 1} of 2)`);

		const askedQuestions = questions[questionSet];
		const rows = askedQuestions.map((question) =>
			this.getAnswerField(question, askedQuestions.indexOf(question))
		);

		for (const row of rows) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			modal.addComponents(row);
		}

		await interaction.showModal(modal);

		// Answers are handled in src/pieces/commandManager.ts on line 149

		return;
	}

	getAnswer(fields: ModalSubmitFields, questionNum: number): string {
		return fields.getField(`question${questionNum + 1}`).value;
	}

	getAnswerField(question: string, questionNum: number): ActionRowBuilder {
		return new ActionRowBuilder({
			components: [
				new TextInputBuilder()
					.setCustomId(`question${questionNum + 1}`)
					.setLabel(`${question}`)
					.setStyle(TextInputStyle.Short)
					.setPlaceholder('Input Answer Here')
			]
		});
	}

}
