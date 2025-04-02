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
} from "discord.js";
import fetchJobListings from "@root/src/lib/utils/jobUtils/Adzuna_job_search";
import { JobResult } from "@root/src/lib/types/JobResult";
import { Interest } from "@root/src/lib/types/Interest";
import { JobData } from "@root/src/lib/types/JobData";
import { Command } from "@lib/types/Command";
import { DB, BOT } from "@root/config";
import { Job } from "@root/src/lib/types/Job";
import { MongoClient } from "mongodb";

// Temporary storage for user job data
const userJobData = new Map<string, { jobs: JobResult[]; index: number }>();

export default class extends Command {
	description = `Get a listing of jobs based on your interests and preferences.`;
	extendedHelp = `This command will return a listing of jobs based on your interests and preferences.`;

	options: ApplicationCommandOptionData[] = [
		{
			name: "filter",
			description: "Filter options for job listings",
			type: ApplicationCommandOptionType.String,
			required: false,
			choices: [
				{ name: "Date Posted", value: "date" },
				{ name: "Salary", value: "salary" },
				{ name: "Alphabetical", value: "alphabetical" },
			],
		},
	];
	// options: ApplicationCommandOptionData[] = [
	// 	{
	// 		name: 'question',
	// 		description: 'The question you want to ask',
	// 		type: ApplicationCommandOptionType.String,
	// 		required: true
	// 	}
	// ]

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<void | InteractionResponse<boolean>> {
		const userID = interaction.user.id;
		const filterBy = interaction.options.getString("filter") ?? "default";
		//const client = await MongoClient.connect(DB.CONNECTION, { useUnifiedTopology: true });
		// const jobData:JobData = {
		// 	city: jobformAnswers[0].answers[0],
		// 	preference: jobformAnswers[0].answers[1],
		// 	jobType: jobformAnswers[0].answers[2],
		// 	distance: jobformAnswers[0].answers[3],
		// 	// filterBy: filterBy ?? 'default'
		// 	filterBy: 'default'
		// };
		// Fetch job data (replace with your actual logic)
		// const interests:Interest = {
		// 	interest1: jobformAnswers[1].answers[0],
		// 	interest2: jobformAnswers[1].answers[1],
		// 	interest3: jobformAnswers[1].answers[2],
		// 	interest4: jobformAnswers[1].answers[3],
		// 	interest5: jobformAnswers[1].answers[4]
		// };
		const jobData: JobData = {
			city: "New York",
			preference: "Software Engineer",
			jobType: "Full Time",
			distance: "10",
			filterBy: filterBy,
		};

		const interests: Interest = {
			interest1: "Software",
			interest2: "Engineer",
			interest3: "Full Time",
			interest4: "New York",
			interest5: "10",
		};

		const APIResponse: JobResult[] = await fetchJobListings(
			jobData,
			interests
		);
		//const results = [jobData, interests, APIResponse];
		//const jobFormData: [JobData, Interest, JobResult[]] = [jobData, interests, APIResponse];
		//const filterBy = interaction.options.getString('filter') ?? 'default';

		if (APIResponse.length === 0) {
			await interaction.reply("No jobs found based on your interests.");
			return;
		}

		// Store job data for the user
		userJobData.set(userID, { jobs: APIResponse, index: 0 });

		// Create embed and buttons for the first job
		const { embed, row } = this.createJobEmbed(
			APIResponse[0],
			0,
			APIResponse.length
		);
		await interaction.reply({ embeds: [embed], components: [row] });

		// Listen for button interactions
		const collector = interaction.channel?.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60000, // 1 minute timeout
		});

		collector?.on("collect", async (i) => {
			if (i.user.id !== userID) {
				await i.reply({
					content: "This is not your interaction!",
					ephemeral: true,
				});
				return;
			}

			const userData = userJobData.get(userID);
			if (!userData) return;

			let { jobs, index } = userData;

			switch (i.customId) {
				case "previous":
					index = index > 0 ? index - 1 : jobs.length - 1;
					break;
				case "next":
					index = index < jobs.length - 1 ? index + 1 : 0;
					break;
				case "remove":
					jobs.splice(index, 1);
					if (jobs.length === 0) {
						await i.update({
							content: "No more jobs to display.",
							embeds: [],
							components: [],
						});
						userJobData.delete(userID);
						return;
					}
					index = index >= jobs.length ? 0 : index;
					break;
			}

			// Update user data
			userJobData.set(userID, { jobs, index });

			// Update embed and buttons
			const { embed, row } = this.createJobEmbed(
				jobs[index],
				index,
				jobs.length
			);
			await i.update({ embeds: [embed], components: [row] });
		});

		collector?.on("end", () => {
			userJobData.delete(userID);
		});
	}

	createJobEmbed(
		job: JobResult,
		index: number,
		totalJobs: number
	): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
		const embed = new EmbedBuilder()
			.setTitle(job.title)
			.setDescription(
				`**Location:** ${job.location}\n**Date Posted:** ${new Date(
					job.created
				).toDateString()}`
			)
			.addFields(
				{ name: "Salary", value: this.formatSalary(job), inline: true },
				{
					name: "Apply Here",
					value: `[Click here](${job.link})`,
					inline: true,
				}
			)
			.setFooter({ text: `Job ${index + 1} of ${totalJobs}` })
			.setColor("#0099ff");

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId("previous")
				.setLabel("Previous")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(totalJobs === 1),
			new ButtonBuilder()
				.setCustomId("remove")
				.setLabel("Remove")
				.setStyle(ButtonStyle.Danger)
				.setDisabled(totalJobs === 1),
			new ButtonBuilder()
				.setCustomId("next")
				.setLabel("Next")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(totalJobs === 1)
		);

		return { embed, row };
	}

	formatSalary(job: JobResult): string {
		const avgSalary = (Number(job.salaryMax) + Number(job.salaryMin)) / 2;
		const formattedAvgSalary = this.formatCurrency(avgSalary);
		const formattedSalaryMax =
			this.formatCurrency(Number(job.salaryMax)) !== "N/A"
				? this.formatCurrency(Number(job.salaryMax))
				: "";
		const formattedSalaryMin =
			this.formatCurrency(Number(job.salaryMin)) !== "N/A"
				? this.formatCurrency(Number(job.salaryMin))
				: "";

		return formattedSalaryMin && formattedSalaryMax
			? `Avg: ${formattedAvgSalary}\nMin: ${formattedSalaryMin}\nMax: ${formattedSalaryMax}`
			: formattedAvgSalary;
	}

	formatCurrency(currency: number): string {
		return isNaN(currency)
			? "N/A"
			: `${new Intl.NumberFormat("en-US", {
					style: "currency",
					currency: "USD",
			  }).format(Number(currency))}`;
	}
}
