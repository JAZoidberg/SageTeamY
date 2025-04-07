import { Command } from '@root/src/lib/types/Command';
import {
	ChannelType,
	ChatInputCommandInteraction,
	InteractionResponse,
	PermissionFlagsBits,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ButtonInteraction,
	TextChannel,
	Message
} from 'discord.js';
import { validatePreferences } from '../../lib/utils/jobUtils/validatePreferences';

// All questions in a single sequence
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

// Timeout for channel auto-deletion (10 minutes of inactivity)
const CHANNEL_TIMEOUT = 10 * 60 * 1000;

export default class extends Command {

	name = 'jobprefs';
	description = 'Start a private conversation to set your job preferences for the Job Alert System';

	// Track active sessions to prevent multiple channels per user
	private activeSessions = new Map<string, {
		channelId: string,
		timeout: NodeJS.Timeout,
		currentQuestion: number,
		answers: string[],
		collector?: any
	}>();
	client: any;

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		const { user, guild } = interaction;

		// Check if user already has an active session
		if (this.activeSessions.has(user.id)) {
			const session = this.activeSessions.get(user.id);
			const existingChannel = guild.channels.cache.get(session.channelId) as TextChannel;
			if (existingChannel) {
				return interaction.reply({
					content: `You already have an active job preferences session in <#${existingChannel.id}>. Please complete or cancel that session first.`,
					ephemeral: true
				});
			} else {
				// Clean up orphaned session
				this.activeSessions.delete(user.id);
			}
		}

		await interaction.deferReply({ ephemeral: true });

		// Create a private channel visible only to the user and bot/admins
		const privateChannel = await guild.channels.create({
			name: `job-prefs-${user.username}`,
			type: ChannelType.GuildText,
			permissionOverwrites: [
				{
					id: guild.id, // @everyone role
					deny: [PermissionFlagsBits.ViewChannel]
				},
				{
					id: user.id,
					allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
				},
				{
					id: interaction.client.user.id, // Bot user
					allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
				}
			]
		});

		// Initialize session data
		const session = {
			channelId: privateChannel.id,
			timeout: setTimeout(() => this.handleSessionTimeout(user.id), CHANNEL_TIMEOUT),
			currentQuestion: 0,
			answers: new Array(questions.length).fill('') // Initialize empty answers array
		};

		this.activeSessions.set(user.id, session);

		// Send welcome message and first question
		await privateChannel.send({
			content: `👋 Welcome to the Job Preferences setup, <@${user.id}>!\n\nI'll guide you through setting up your job preferences. You can use the following commands at any time:\n• Type \`;;stop\` to cancel and delete this channel\n• Type \`;;back\` to go back to the previous question\n• Type \`;;skip\` to skip the current question\n• Type \`;;save\` to save your current progress\n\nIf you need to enter an answer that starts with \`;;\`, prefix it with a backslash (e.g. \`\\;;your answer\`).\n\nLet's get started!`
		});

		// Send initial question
		await this.askNextQuestion(privateChannel, user.id);

		// Notify user about the new channel
		await interaction.editReply({
			content: `I've created a private channel for you: <#${privateChannel.id}>\nPlease head there to set up your job preferences!`
		});

		// Set up message collector for this channel
		this.setupMessageCollector(privateChannel, user.id);
	}

	private async askNextQuestion(channel: TextChannel, userId: string): Promise<void> {
		const session = this.activeSessions.get(userId);
		if (!session) return;

		// Reset timeout
		clearTimeout(session.timeout);
		session.timeout = setTimeout(() => this.handleSessionTimeout(userId), CHANNEL_TIMEOUT);

		const { currentQuestion } = session;
		// Check if we've completed all questions
		if (currentQuestion >= questions.length) {
			return this.finalizePreferences(channel, userId);
		}

		// Get the current question
		const questionText = questions[currentQuestion];
		const questionNumber = currentQuestion + 1;
		const totalQuestions = questions.length;

		// Send the question with progress indicator
		await channel.send({
			content: `**Question ${questionNumber}/${totalQuestions}:** ${questionText}\n\nPlease type your answer below.`
		});
	}

	private setupMessageCollector(channel: TextChannel, userId: string): void {
		const filter = (message: Message) => message.author.id === userId;
		const collector = channel.createMessageCollector({ filter });

		// Store collector in session for cleanup
		const session = this.activeSessions.get(userId);
		if (session) {
			session.collector = collector;
		}

		collector.on('collect', async (message) => {
			const session = this.activeSessions.get(userId);
			if (!session) return;

			let content = message.content.trim();

			// If the answer is escaped with a backslash (e.g., "\;;example"), remove the escape.
			if (content.startsWith('\\;;')) {
				content = content.substring(1);
			} else if (content.startsWith(';;')) {
				// Check if it's one of our commands.
				if (content === ';;stop' || content === ';;back' || content === ';;skip' || content === ';;save') {
					switch (content) {
						case ';;stop':
							await this.handleStop(channel, userId);
							return;
						case ';;back':
							await this.handleBack(channel, userId);
							return;
						case ';;skip':
							await this.handleSkip(channel, userId);
							return;
						case ';;save':
							await this.handleSave(channel, userId);
							return;
					}
				} else {
					await channel.send("Command not understood. Available commands: ;;stop, ;;back, ;;skip, ;;save. To enter an answer that starts with ';;', prefix it with a backslash (e.g. `\\;;your answer`).");
					return;
				}
			}

			// Process the answer normally.
			const { currentQuestion, answers } = session;
			answers[currentQuestion] = content;
			session.currentQuestion++;
			await this.askNextQuestion(channel, userId);
		});
	}

	private async handleStop(channel: TextChannel, userId: string): Promise<void> {
		const session = this.activeSessions.get(userId);
		if (session) {
			clearTimeout(session.timeout);
			if (session.collector) session.collector.stop();
			this.activeSessions.delete(userId);
		}
		await channel.send('❌ Session cancelled. This channel will be deleted in 5 seconds...');
		setTimeout(async () => {
			try {
				await channel.delete();
			} catch (error) {
				console.error('Failed to delete channel:', error);
			}
		}, 5000);
	}

	private async handleBack(channel: TextChannel, userId: string): Promise<void> {
		const session = this.activeSessions.get(userId);
		if (!session) return;
		if (session.currentQuestion > 0) {
			session.currentQuestion--;
			await channel.send('Going back to the previous question...');
			await this.askNextQuestion(channel, userId);
		} else {
			await channel.send("You're already at the first question.");
		}
	}

	private async handleSkip(channel: TextChannel, userId: string): Promise<void> {
		const session = this.activeSessions.get(userId);
		if (!session) return;
		// Record an empty answer and move to next question.
		session.answers[session.currentQuestion] = '';
		session.currentQuestion++;
		await channel.send('Question skipped.');
		await this.askNextQuestion(channel, userId);
	}

	private async handleSave(channel: TextChannel, userId: string): Promise<void> {
		const session = this.activeSessions.get(userId);
		if (!session) return;
		if (session.collector) session.collector.stop();
		// Persist the progress (replace this with your actual saving logic)
		this.persistPreferences(userId, session.answers);
		await channel.send('✅ Your progress has been saved! You can return anytime using the `/jobprefs` command. This channel will be deleted in 10 seconds.');
		clearTimeout(session.timeout);
		setTimeout(() => {
			this.activeSessions.delete(userId);
			channel.delete().catch(console.error);
		}, 10000);
	}

	// Simulate persisting the preferences (replace with your database logic)
	private persistPreferences(userId: string, answers: string[]): void {
		console.log(`Persisting preferences for user ${userId}:`, answers);
	}

	private async handleSessionTimeout(userId: string): Promise<void> {
		const session = this.activeSessions.get(userId);
		if (!session) return;
		if (session.collector) session.collector.stop();
		const channel = await this.getChannelFromSession(session);
		if (channel) {
			await channel.send('⏰ This session has timed out due to inactivity. Your progress has been saved. This channel will be deleted in 30 seconds.');
			setTimeout(() => {
				channel.delete().catch(console.error);
			}, 30000);
		}
		this.activeSessions.delete(userId);
	}

	private async getChannelFromSession(session: any): Promise<TextChannel | null> {
		try {
			const channel = await this.client.channels.fetch(session.channelId) as TextChannel;
			return channel;
		} catch (error) {
			console.error('Failed to fetch channel:', error);
			return null;
		}
	}

	private async finalizePreferences(channel: TextChannel, userId: string): Promise<void> {
		const session = this.activeSessions.get(userId);
		if (!session) return;
		if (session.collector) session.collector.stop();

		const { answers } = session;
		const locationAnswers = answers.slice(0, 4);
		const interestAnswers = answers.slice(4, 9);

		const locationValidation = validatePreferences(locationAnswers, 0, true);
		const interestValidation = validatePreferences(interestAnswers, 1, true);

		if (!locationValidation.isValid || !interestValidation.isValid) {
			let errorMessage = 'There are some issues with your preferences:';
			if (!locationValidation.isValid) {
				errorMessage += `\n\n**Location Preferences:**\n${locationValidation.errors.join('\n')}`;
			}
			if (!interestValidation.isValid) {
				errorMessage += `\n\n**Interest Preferences:**\n${interestValidation.errors.join('\n')}`;
			}

			const row = new ActionRowBuilder<ButtonBuilder>()
				.addComponents(
					new ButtonBuilder()
						.setCustomId('edit_preferences')
						.setLabel('Edit Preferences')
						.setStyle(ButtonStyle.Primary),
					new ButtonBuilder()
						.setCustomId('save_anyway')
						.setLabel('Save Anyway')
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId('cancel_preferences')
						.setLabel('Cancel')
						.setStyle(ButtonStyle.Danger)
				);

			await channel.send({
				content: errorMessage,
				components: [row]
			});
		} else {
			await this.savePreferences(channel, userId, answers);
		}
	}

	private async savePreferences(channel: TextChannel, userId: string, answers: string[]): Promise<void> {
		this.persistPreferences(userId, answers);
		let summary = '📋 **Your Job Preferences Summary**\n\n';
		summary += '**Location Preferences:**\n';
		for (let i = 0; i < 4; i++) {
			summary += `• ${questions[i]}: ${answers[i] ? answers[i] : '(skipped)'}\n`;
		}
		summary += '\n**Interest Preferences:**\n';
		for (let i = 4; i < 9; i++) {
			summary += `• ${questions[i]}: ${answers[i] ? answers[i] : '(skipped)'}\n`;
		}

		await channel.send(summary);
		await channel.send("✅ Your job preferences have been saved successfully! You'll start receiving job alerts based on these preferences. You can update them anytime using the `/jobprefs` command.\n\nThis channel will be deleted in 30 seconds.");

		const session = this.activeSessions.get(userId);
		if (session) {
			clearTimeout(session.timeout);
			setTimeout(() => {
				this.activeSessions.delete(userId);
				channel.delete().catch(console.error);
			}, 30000);
		}
	}

	// Handle button interactions for validation errors.
	async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
		const { user, customId, channel } = interaction;
		if (!this.activeSessions.has(user.id)) {
			await interaction.reply({
				content: 'This session has expired. Please start a new session with `/jobprefs`.',
				ephemeral: true
			});
			return;
		}
		const session = this.activeSessions.get(user.id);
		switch (customId) {
			case 'edit_preferences':
				session.currentQuestion = 0;
				await interaction.reply("Let's go through your preferences again to fix any issues.");
				await this.askNextQuestion(channel as TextChannel, user.id);
				break;
			case 'save_anyway':
				await interaction.reply('Saving preferences despite validation issues...');
				await this.savePreferences(channel as TextChannel, user.id, session.answers);
				break;
			case 'cancel_preferences':
				await interaction.reply('Cancelling preferences setup...');
				await this.handleStop(channel as TextChannel, user.id);
				break;
		}
	}
}
