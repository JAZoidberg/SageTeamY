import { Command } from "@root/src/lib/types/Command";
import {
	ActionRowBuilder,
	ChatInputCommandInteraction,
	InteractionResponse,
	ModalBuilder,
	ModalSubmitFields,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";

const questions = [
	"Question 1",
	"Question 2",
	"Question 3",
	"Question 4",
	"Question 5",
];

export default class extends Command {
	name = "jobform";
	description =
		"Form to get your preferences for jobs to be used with the Job Alert System!";

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<InteractionResponse<boolean> | void> {
		const modal = new ModalBuilder()
			.setCustomId("jobModal")
			.setTitle("Job Form");

		const rows = questions.map((question) =>
			this.getAnswerField(questions.indexOf(question))
		);

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
		return new ActionRowBuilder({
			components: [
				new TextInputBuilder()
					.setCustomId(`question${questionNum + 1}`)
					.setLabel(`Question ${questionNum + 1}`)
					.setStyle(TextInputStyle.Short)
					.setPlaceholder("Input Answer Here"),
			],
		});
	}
}
