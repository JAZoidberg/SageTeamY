import {
	ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	InteractionResponse,
	AttachmentBuilder,
} from 'discord.js';
import fetchJobListings from '@root/src/lib/utils/jobUtils/Adzuna_job_search';
import { JobResult } from '@root/src/lib/types/JobResult';
import { Interest } from '@root/src/lib/types/Interest';
import { JobData } from '@root/src/lib/types/JobData';
import { Command } from '@lib/types/Command';
import { DB, BOT, MAP_KEY } from '@root/config';
import { MongoClient } from 'mongodb';
import axios from 'axios';
import { JobPreferences } from '@root/src/lib/types/JobPreferences';

// Temporary storage for user job data
const userJobData = new Map<string, { jobs: JobResult[]; index: number }>();

export default class JobsCommand extends Command {
	description = `Get a listing of jobs based on your interests and preferences.`;

	options: ApplicationCommandOptionData[] = [
		{
			name: 'filter',
			description: 'Filter options for job listings',
			type: ApplicationCommandOptionType.String,
			required: false,
			choices: [
				{ name: 'Date Posted', value: 'date' },
				{ name: 'Salary', value: 'salary' },
				{ name: 'Alphabetical', value: 'alphabetical' },
				{ name: 'Distance', value: 'distance' },
			],
		},
	];

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<void | InteractionResponse<boolean>> {
		const userID = interaction.user.id;
		const filterBy = interaction.options.getString('filter') ?? 'default';

		// Fetch user preferences from DB
		const client = await MongoClient.connect(DB.CONNECTION, {
			useUnifiedTopology: true,
		});
		const db = client.db(BOT.NAME).collection(DB.USERS);
		const jobformPreferences = (
			await db.findOne({ discordId: userID })
		)?.jobPreferences as JobPreferences | null;

		if (!jobformPreferences) {
			await interaction.reply({
				content: "You haven't set up your job preferences yet. Please use `/jobform` first.",
				flags: 64,
			});
			return;
		}

		// Extract and trim answers array
		const answers = jobformPreferences.answers;
		const city = answers[0].trim();
		const preference = answers[1].trim();
		const jobType = answers[2].trim();
		const distance = answers[3].trim();
		const interests: Interest = {
			interest1: answers[4].trim(),
			interest2: answers[5].trim(),
			interest3: answers[6].trim(),
			interest4: answers[7].trim(),
			interest5: answers[8].trim(),
		};

		const jobData: JobData = { city, preference, jobType, distance, filterBy };

		// Fetch listings
		const APIResponse: JobResult[] = await fetchJobListings(jobData, interests);

		if (APIResponse.length === 0) {
			await interaction.reply({ content: 'No jobs found based on your interests.', flags: 64 });
			return;
		}

		// Store job data
		userJobData.set(userID, { jobs: APIResponse, index: 0 });

		// Send first embed
		const { embed, row } = this.createJobEmbed(APIResponse[0], 0, APIResponse.length);
		await interaction.reply({ embeds: [embed], components: [row] });

		// Button collector
		const collector = interaction.channel?.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60000,
		});

		collector?.on('collect', async (i) => {
			if (i.user.id !== userID) {
				await i.reply({ content: 'This is not your interaction!', flags: 64 });
				return;
			}

			const userData = userJobData.get(userID);
			if (!userData) return;

			let { jobs, index } = userData;
			switch (i.customId) {
				case 'previous':
					index = index > 0 ? index - 1 : jobs.length - 1;
					break;
				case 'next':
					index = index < jobs.length - 1 ? index + 1 : 0;
					break;
				case 'remove':
					jobs.splice(index, 1);
					if (jobs.length === 0) {
						await i.update({ content: 'No more jobs to display.', embeds: [], components: [] });
						userJobData.delete(userID);
						return;
					}
					index = index >= jobs.length ? 0 : index;
					break;
			}

			userJobData.set(userID, { jobs, index });
			const { embed: newEmbed, row: newRow } = this.createJobEmbed(jobs[index], index, jobs.length);
			await i.update({ embeds: [newEmbed], components: [newRow] });
		});

		collector?.on('end', () => userJobData.delete(userID));
	}

	createJobEmbed(job: JobResult, index: number, total: number) {
		const embed = new EmbedBuilder()
			.setTitle(job.title)
			.setDescription(`**Location:** ${job.location}\n**Date Posted:** ${new Date(job.created).toDateString()}`)
			.addFields(
				{ name: 'Salary', value: this.formatSalary(job), inline: true },
				{ name: 'Apply Here', value: `[Apply](${job.link})`, inline: true }
			)
			.setFooter({ text: `Job ${index + 1} of ${total}` });

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId('previous').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(total === 1),
			new ButtonBuilder().setCustomId('remove').setLabel('Remove').setStyle(ButtonStyle.Danger).setDisabled(total === 1),
			new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(total === 1)
		);

		return { embed, row };
	}

	formatSalary(job: JobResult): string {
		const avg = (Number(job.salaryMax) + Number(job.salaryMin)) / 2;
		const fmt = (val: number) => isNaN(val) ? 'N/A' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
		const min = fmt(Number(job.salaryMin));
		const max = fmt(Number(job.salaryMax));
		return min !== 'N/A' && max !== 'N/A' ? `Avg: ${fmt(avg)}\nMin: ${min}\nMax: ${max}` : fmt(avg);
	}

	calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const rad = (d: number) => (d * Math.PI) / 180;
		const R = 3958.8;
		const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
		const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
		return (lat1===0&&lon1===0)||(lat2===0&&lon2===0)? -1 : R*c;
	}

	async queryCoordinates(location: string): Promise<{ lat: number; lng: number }> {
		const res = await axios.get(`https://maps.google.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&components=country:US&key=${MAP_KEY}`);
		return res.data.results[0].geometry.location;
	}
}
