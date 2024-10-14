import { Command } from '@root/src/lib/types/Command';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle,
	ChatInputCommandInteraction, EmbedBuilder, InteractionResponse,
	ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

const questions = ['Question 1', 'Question 2', 'Question 3', 'Question 4', 'Question 5'];

export default class extends Command {

	description = 'Form to get your preferences for jobs to be used with the Job Alert System!';

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		const modal = new ModalBuilder()
			.setCustomId('modalInput')
			.setTitle('Job Form');

		const rows = questions.map((question) => this.getAnswerField(questions.indexOf(question)));

		for (const row of rows) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			modal.addComponents(row);
		}

		interaction.showModal(modal);
		return;

		// let questionNum = 0;

		// // Button to go to the next question
		// const nextButton = new ButtonBuilder()
		// 	.setCustomId('nextQuestion')
		// 	.setLabel('Next Question')
		// 	.setStyle(ButtonStyle.Primary)
		// 	.setEmoji('▶');

		// // Button to change the users answer
		// const editAnswer = new ButtonBuilder()
		// 	.setCustomId('editAnswer')
		// 	.setLabel('Edit Answer')
		// 	.setStyle(ButtonStyle.Success);

		// let actionRow = new ActionRowBuilder()
		// 	.addComponents(editAnswer)
		// 	.addComponents(nextButton);
		// // The modal that gets shown to the user
		// const modal = new ModalBuilder().setCustomId('answerModal').setTitle(`Question ${questionNum}`);

		// const userAnswer = new TextInputBuilder()
		// 	.setCustomId('userInput')
		// 	.setLabel('Answer')
		// 	.setStyle(TextInputStyle.Short)
		// 	.setPlaceholder('Input your answer here');

		// const modalRow = new ActionRowBuilder().addComponents(userAnswer);

		// // eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// // @ts-ignore
		// modal.addComponents(modalRow);

		// // Send the initial embed
		// interaction.reply({
		// 	embeds: [this.questionGetter(questionNum)],
		// 	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// 	// @ts-ignore
		// 	components: [actionRow]
		// });

		// // Get the ID of the sent message to handle buttons being pushed
		// let replyId;
		// interaction.fetchReply().then(reply => { replyId = reply.id; });

		// const collector = interaction.channel.createMessageComponentCollector({
		// 	filter: i => i.message.id === replyId
		// });

		// interaction.channel.send({ modal, reply: { messageReference: replyId } });

		// collector.on('collect', async (i: ButtonInteraction) => {
		// 	// If someone else trys pushing a button, tell them no
		// 	if (interaction.user.id !== i.user.id) {
		// 		await i.reply({
		// 			content: 'You cannot respond to a command you did not execute',
		// 			ephemeral: true
		// 		});
		// 		return;
		// 	}
		// 	i.deferUpdate();
		// 	// Next question button
		// 	if (i.customId === 'nextQuestion') {
		// 		questionNum++;
		// 		actionRow = questionNum === (questions.length - 1)
		// 			? new ActionRowBuilder({ components: [editAnswer, nextButton.setDisabled(true)] })
		// 			: new ActionRowBuilder({ components: [editAnswer, nextButton] });
		// 	// Edit answer button
		// 	} else if (i.customId === 'editAnswer') {
		// 		await modalInteraction.showModal(modal);
		// 	}
		// 	interaction.editReply({
		// 		embeds: [this.questionGetter(questionNum)],
		// 		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// 		// @ts-ignore
		// 		components: [actionRow]
		// 	});
		// });

		// return;
	}

	getAnswerField(questionNum: number): ActionRowBuilder {
		return new ActionRowBuilder({ components: [new TextInputBuilder()
			.setCustomId(`question ${questionNum + 1}`)
			.setLabel(`Question ${questionNum + 1}`)
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Input Answer Here')] });
	}

}
