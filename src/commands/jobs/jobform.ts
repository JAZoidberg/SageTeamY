import { Command } from '@root/src/lib/types/Command';
import { ActionRowBuilder, ApplicationCommandOptionData, ApplicationCommandOptionType,
	ChatInputCommandInteraction, InteractionResponse, ModalBuilder, ModalSubmitFields,
	TextInputBuilder, TextInputStyle } from 'discord.js';

const questions = [
	['What city are you located in?', 'Are you looking for something remote or in person?', 'Are you looking for a job, internship or both?', 'How far are you willing to travel?'],
	['Interest 1', 'Interest 2', 'Interest 3', 'Interest 4', 'Interest 5']
];

export default class extends Command {

	name = 'jobform';
	description = 'Form to get your preferences for jobs to be used with the Job Alert System!';

	options: ApplicationCommandOptionData[] = [
		{
			name: 'qSet',
			description: 'Which question set do you want to view (1 or 2).',
			type: ApplicationCommandOptionType.Number,
			required: true
		}
	]

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		const questionSet = interaction.options.getNumber('Question Set');

		if (questionSet === 1 || questionSet === 2) {
			interaction.reply({ content: 'Please enter either 1 or 2' });
			return;
		}

		const modal = new ModalBuilder()
			.setCustomId(`jobModal${questionSet}`)
			.setTitle(`Job Form (${questionSet} of 2)`);

		const rows = questions[questionSet].map((question) => this.getAnswerField(questions[questionSet].indexOf(question)));

		for (const row of rows) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			modal.addComponents(row);
		}

		await interaction.showModal(modal);

		// Answers are handled in commandManager.ts on line 149

		return;
	}


	getAnswer(fields: ModalSubmitFields, questionNum: number): string {
		return fields.getField(`question${questionNum + 1}`).value;
	}


	getAnswerField(questionNum: number): ActionRowBuilder {
		return new ActionRowBuilder({ components: [new TextInputBuilder()
			.setCustomId(`question${questionNum + 1}`)
			.setLabel(`Question ${questionNum + 1}`)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Input Answer Here')] });
	}

}
