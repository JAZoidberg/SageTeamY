import { Command } from '@root/src/lib/types/Command';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, InteractionResponse } from 'discord.js';

const questions = ['Question 1', 'Question 2'];

export default class extends Command {

	description = 'Form to get your preferences for jobs to be used with the Job Alert System!';

	run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		let questionNum = 0;

		const nextButton = new ButtonBuilder()
			.setCustomId('nextQuestion')
			.setLabel('Next Question')
			.setStyle(ButtonStyle.Primary)
			.setEmoji('▶');

		let actionRow = new ActionRowBuilder()
			.addComponents(nextButton);

		interaction.reply({
			embeds: [this.questionGetter(questionNum)],
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			components: [actionRow]
		});

		let replyId;
		interaction.fetchReply().then(reply => { replyId = reply.id; });

		const collector = interaction.channel.createMessageComponentCollector({
			filter: i => i.message.id === replyId
		});

		collector.on('collect', async (i: ButtonInteraction) => {
			if (interaction.user.id !== i.user.id) {
				await i.reply({
					content: 'You cannot respond to a command you did not execute',
					ephemeral: true
				});
				return;
			}
			i.deferUpdate();
			if (i.customId === 'nextQuestion') {
				questionNum++;
				actionRow = questionNum === (questions.length - 1)
					? new ActionRowBuilder({ components: [nextButton.setDisabled(true)] })
					: new ActionRowBuilder({ components: [nextButton] });
			}
			interaction.editReply({
				embeds: [this.questionGetter(questionNum)],
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				components: [actionRow]
			});
		});

		return;
	}

	questionGetter(questionNum: number): EmbedBuilder {
		return new EmbedBuilder()
			.setTitle('Job Alert Form')
			.setColor('#000000')
			.addFields(
				{ name: 'Question:', value: questions[questionNum] },
				{ name: 'Answer', value: 'also test', inline: true });
	}

}
