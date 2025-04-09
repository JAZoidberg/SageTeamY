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
} from "discord.js";
import fetchJobListings from "@root/src/lib/utils/jobUtils/Adzuna_job_search";
import { JobResult } from "@root/src/lib/types/JobResult";
import { Interest } from "@root/src/lib/types/Interest";
import { JobData } from "@root/src/lib/types/JobData";
import { Command } from "@lib/types/Command";
import { DB, BOT, MAP_KEY } from "@root/config";
import { MongoClient } from "mongodb";
import { sendToFile } from "@root/src/lib/utils/generalUtils";
import axios from "axios";
import { JobPreferences } from "@root/src/lib/types/JobPreferences";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";

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
				{ name: "Date Posted: recent", value: "date" },
				{ name: "Salary: high-low average", value: "salary" },
				{ name: "Alphabetical: A-Z", value: "alphabetical" },
				{ name: "Distance: shortest-longest", value: "distance" },
			],
		},
	];

	//-------------------ADDED PDF GENERATATOR METHOD----------------------
	private async generateJobPDF(jobs: JobResult[]): Promise<Buffer> {
		// Create a new PDF document.
		const pdfDoc = await PDFDocument.create();
		let currentPage = pdfDoc.addPage();
		const { width, height } = currentPage.getSize();
		const margin = 40;
		let yPosition = height - margin- 50;
		const fontSize = 10;
		const titleFontSize = 30;
		const bulletPointIndent = 20;
		const subBulletPointIndent = 30; // Indentation for sub-bullet points



		// Embed a standard font.
		const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
		const HelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold );
		const Helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica );

		


		// Draw the title.
		const lineHeight = 10; // Height of the line
		const lineWidth = (width - margin * 2) / 3;

		currentPage.drawRectangle({
			x: margin,
			y: yPosition+50,
			width: lineWidth,
			height: lineHeight,
			color: rgb(135 / 255, 59 / 255, 29 / 255), // red color
		});
		
		// Draw the second color segment
		currentPage.drawRectangle({
			x: margin + lineWidth,
			y: yPosition+50,
			width: lineWidth,
			height: lineHeight,
			color: rgb(237 / 255, 118 / 255, 71 / 255), // orangey color
		});
		
		// Draw the third color segment
		currentPage.drawRectangle({
			x: margin + lineWidth * 2,
			y: yPosition+50,
			width: lineWidth,
			height: lineHeight,
			color: rgb(13/255, 158/255, 198/255), // Blue color
		});
		
		yPosition -= 40; // Adjust spacing below the line



		currentPage.drawText("List of Jobs PDF", {
			x: margin,
			y: yPosition+50,
			size: titleFontSize,
			font: HelveticaBold,
			
			color: rgb(114/255, 53/255, 9/255),
		});
		yPosition -= 40;

		currentPage.drawRectangle({
			x: margin,
			y: yPosition+50,
			width: lineWidth/2,
			height: lineHeight-8,
			color: rgb(135 / 255, 59 / 255, 29 / 255), // red color
		});
		yPosition -= 10;

		// Loop through each job and add its details.
		for (let i = 0; i < jobs.length; i++) {
			const job = jobs[i];

			if (yPosition - fontSize*2 < margin) {
				currentPage = pdfDoc.addPage();
				yPosition = currentPage.getHeight() - margin-20;
			}
	
			const maxWidth = width - margin * 2; // Calculate available width
			const wrappedTitle = this.wrapText(`${i + 1}. ${job.title}`, HelveticaBold, fontSize + 10, maxWidth);

			

			for (const line of wrappedTitle) {
				// Check if there's enough space for the line
				if (yPosition - fontSize*2 < margin) {
					currentPage = pdfDoc.addPage();
					yPosition = currentPage.getHeight() - margin-20;
				}

				currentPage.drawText(line, {
					x: margin,
					y: yPosition+30,
					size: fontSize + 10,
					font: HelveticaBold,
					color: rgb(241 / 255, 113 / 255, 34 / 255),
				});

				yPosition -= 30; // Adjust spacing between lines
			}
	
			// Draw the bullet points for location, salary, and apply link.
			const bulletPoints = [
				{ label: "Location", value: job.location },
				{ label: "Salary", value: this.formatSalaryforPDF(job) },
				{ label: "Apply Here", value: job.link },
			];
	
			for (const point of bulletPoints) {
				// Check if there's enough space on the page, and add a new page if needed.
				if (yPosition - fontSize *2 < margin) {
					currentPage = pdfDoc.addPage();
					yPosition = currentPage.getHeight() - margin-20;
				}

				const maxLabelWidth = width - margin * 2 - bulletPointIndent - subBulletPointIndent;
    			const wrappedLabel = this.wrapText(`• ${point.label}`, HelveticaBold, fontSize + 5, maxLabelWidth);

    			// Draw the wrapped label
				for (const line of wrappedLabel) {
					// Check if there's enough space for the line
					if (yPosition - fontSize*2 < margin) {
						currentPage = pdfDoc.addPage();
						yPosition = currentPage.getHeight() - margin-20;
					}

					currentPage.drawText(line, {
						x: margin + bulletPointIndent,
						y: yPosition+25,
						size: fontSize + 5,
						font: HelveticaBold,
						color: rgb(94 / 255, 74 / 255, 74 / 255),
					});

					yPosition -= fontSize + 10; // Adjust spacing between lines
				}
				

				const combinedText = `•${point.value}`;
				const maxValueWidth = width - margin * 2 - bulletPointIndent - subBulletPointIndent;
				const wrappedValue = this.wrapText(combinedText, HelveticaBold, fontSize+4, maxValueWidth);

				
				for (const line of wrappedValue) {
					// Check if there's enough space for the line
					if (yPosition - fontSize*2 < margin) {
						currentPage = pdfDoc.addPage();
						yPosition = currentPage.getHeight() - margin-20;
					}

					currentPage.drawText(line, {
						x: margin + bulletPointIndent + subBulletPointIndent,
						y: yPosition+20,
						size: fontSize+3,
						font: HelveticaBold,
						color: rgb(13 / 255, 158 / 255, 198 / 255),
					});

					yPosition -= fontSize + 5; // Adjust spacing between lines
				}

				yPosition -= 20; // Add extra spacing between items
			}

			yPosition -= 40; // Add extra spacing between jobs.

			
			
		}
		

		const pdfBytes = await pdfDoc.save();
		return Buffer.from(pdfBytes);
	}

	async run(
		interaction: ChatInputCommandInteraction
	): Promise<void | InteractionResponse<boolean>> {
		const userID = interaction.user.id;
		const filterBy = interaction.options.getString("filter") ?? "salary";

		const client = await MongoClient.connect(DB.CONNECTION, {
			useUnifiedTopology: true,
		});
		const db = client.db(BOT.NAME).collection(DB.USERS);
		const jobformAnswers: JobPreferences | null = (
			await db.findOne({ discordId: userID })
		)?.jobPreferences;

		if (!jobformAnswers) {
			await interaction.reply(
				"You haven't set up your job preferences yet. Please use `/jobform` first."
			);
			return;
		}

		const jobData: JobData = {
			city: jobformAnswers.answers.city, 
			preference: jobformAnswers.answers.employmentType, 
			jobType: jobformAnswers.answers.workType, 
			distance: jobformAnswers.answers.travelDistance, 
			filterBy: filterBy,
		};

		const interests: Interest = {
			interest1: jobformAnswers.answers.interest1,
			interest2: jobformAnswers.answers.interest2,
			interest3: jobformAnswers.answers.interest3,
			interest4: jobformAnswers.answers.interest4,
			interest5: jobformAnswers.answers.interest5,
		};

		const APIResponse: JobResult[] = await fetchJobListings(
			jobData,
			interests
		);

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
				//----------------ADDED DOWNLOAD BUTTON--------------------
				case "download":
					await i.deferReply({ ephemeral: true });
					try {
						// Generate the PDF from all stored jobs.
						const pdfBuffer = await this.generateJobPDF(jobs);
						const attachment = new AttachmentBuilder(
							pdfBuffer
						).setName("jobs.pdf");
						await i.editReply({
							content:
								"Here is your PDF file with all job listings:",
							files: [attachment],
						});
					} catch (error) {
						console.error("Error generating PDF:", error);
						await i.editReply({
							content:
								"An error occurred while generating the PDF. Please try again later.",
						});
					}
					return; // Exit early so we don't update the embed.
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

	wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
		const words = text.split(" ");
		const lines: string[] = [];
		let currentLine = "";
	
		for (const word of words) {
			const testLine = currentLine ? `${currentLine} ${word}` : word;
			const textWidth = font.widthOfTextAtSize(testLine, fontSize);
	
			if (textWidth <= maxWidth) {
				currentLine = testLine;
			} else {
				if (currentLine) {
					lines.push(currentLine);
				}
				currentLine = "";
	
				// Handle long words that exceed maxWidth
				let remainingWord = word;
				while (font.widthOfTextAtSize(remainingWord, fontSize) > maxWidth) {
					let splitIndex = Math.floor((maxWidth / font.widthOfTextAtSize(remainingWord, fontSize)) * remainingWord.length);
					const chunk = remainingWord.slice(0, splitIndex);
					lines.push(chunk);
					remainingWord = remainingWord.slice(splitIndex);
				}
				currentLine = remainingWord;
			}
		}
	
		if (currentLine) {
			lines.push(currentLine);
		}
	
		return lines;
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
				.setDisabled(totalJobs === 1),
			//----------------ADDED DOWNLOAD BUTTON-------------------
			new ButtonBuilder()
				.setCustomId("download")
				.setLabel("Download")
				.setStyle(ButtonStyle.Success)
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

	formatSalaryforPDF(job: JobResult): string {
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
			? `Avg: ${formattedAvgSalary}, Min: ${formattedSalaryMin}, Max: ${formattedSalaryMax}`
			: formattedAvgSalary;
	}

	async listJobs(
		jobForm: [JobData, Interest, JobResult[]],
		filterBy: string
	): Promise<string> {
		const cityCoordinates = await this.queryCoordinates(jobForm[0].city);

		if (filterBy === "salary") {
			jobForm[2].sort((a, b) => {
				const avgA = (Number(a.salaryMax) + Number(a.salaryMin)) / 2;
				const avgB = (Number(b.salaryMax) + Number(b.salaryMin)) / 2;

				if (isNaN(avgA)) return 1;
				if (isNaN(avgB)) return -1;

				return avgB - avgA;
			});
		} else if (filterBy === "alphabetical") {
			jobForm[2].sort((a, b) => (a.title > b.title ? 1 : -1));
		} else if (filterBy === "date") {
			jobForm[2].sort(
				(a, b) =>
					new Date(b.created).getTime() -
					new Date(a.created).getTime()
			);
		} else if (filterBy === "distance") {
			jobForm[2].sort((a, b) => {
				const distanceA = this.calculateDistance(
					cityCoordinates.lat,
					cityCoordinates.lng,
					Number(a.latitude),
					Number(a.longitude)
				);
				const distanceB = this.calculateDistance(
					cityCoordinates.lat,
					cityCoordinates.lng,
					Number(b.latitude),
					Number(b.longitude)
				);

				if (distanceA === -1) {
					return 1;
				}

				return distanceA - distanceB;
			});
		}

		let jobList = "";
		for (let i = 0; i < jobForm[2].length; i++) {
			const avgSalary =
				(Number(jobForm[2][i].salaryMax) +
					Number(jobForm[2][i].salaryMin)) /
				2;
			const formattedAvgSalary = this.formatCurrency(avgSalary);
			const formattedSalaryMax =
				this.formatCurrency(Number(jobForm[2][i].salaryMax)) !== "N/A"
					? this.formatCurrency(Number(jobForm[2][i].salaryMax))
					: "";
			const formattedSalaryMin =
				this.formatCurrency(Number(jobForm[2][i].salaryMin)) !== "N/A"
					? this.formatCurrency(Number(jobForm[2][i].salaryMin))
					: "";
			const jobDistance = this.calculateDistance(
				cityCoordinates.lat,
				cityCoordinates.lng,
				Number(jobForm[2][i].latitude),
				Number(jobForm[2][i].longitude)
			);
			const formattedDistance =
				jobDistance !== -1 ? `${jobDistance.toFixed(2)} miles` : "N/A";

			const salaryDetails =
				formattedSalaryMin && formattedSalaryMax
					? `, Min: ${formattedSalaryMin}, Max: ${formattedSalaryMax}`
					: formattedAvgSalary;

			jobList += `${i + 1}. **${jobForm[2][i].title}**  
                \t\t* **Salary Average:** ${formattedAvgSalary}${salaryDetails}  
                \t\t* **Location:** ${jobForm[2][i].location}  
                \t\t* **Date Posted:** ${new Date(
					jobForm[2][i].created
				).toDateString()} at ${new Date(
				jobForm[2][i].created
			).toLocaleTimeString("en-US", {
				hour: "2-digit",
				minute: "2-digit",
			})}
                \t\t* **Apply here:** [read more about the job and apply here](${
					jobForm[2][i].link
				})  
                \t\t* **Distance:** ${formattedDistance}
                ${i !== jobForm[2].length - 1 ? "\n" : ""}`;
		}

		return (
			jobList ||
			"### Unfortunately, there were no jobs found based on your interests :(. Consider updating your interests or waiting until something is found."
		);
	}

	formatCurrency(currency: number): string {
		return isNaN(currency)
			? "N/A"
			: `${new Intl.NumberFormat("en-US", {
					style: "currency",
					currency: "USD",
			  }).format(Number(currency))}`;
	}

	stripMarkdown(message: string, owner: string): string {
		return message
			.replace(
				new RegExp(
					`## Hey <@${owner}>!\\s*## Here's your list of job/internship recommendations:?`,
					"g"
				),
				""
			)
			.replace(/\[read more about the job and apply here\]/g, "")
			.replace(/\((https?:\/\/[^\s)]+)\)/g, "$1")
			.replace(/\*\*([^*]+)\*\*/g, "$1")
			.replace(/##+\s*/g, "")
			.replace(/###|-\#\s*/g, "")
			.trim();
	}

	headerMessage(owner: string, filterBy: string): string {
		return `## Hey <@${owner}>!  
        ### **__Please read this disclaimer before reading your list of jobs/internships__:**  
        -# Please be aware that the job listings displayed are retrieved from a third-party API. \
        While we strive to provide accurate information, we cannot guarantee the legitimacy or security \
        of all postings. Exercise caution when sharing personal information, submitting resumes, or registering \
        on external sites. Always verify the authenticity of job applications before proceeding. Additionally, \
        some job postings may contain inaccuracies due to API limitations, which are beyond our control. We apologize for any inconvenience this may cause and appreciate your understanding.
        ## Here's your list of job/internship recommendations${
			filterBy && filterBy !== "default"
				? ` (filtered based on ${
						filterBy === "date" ? "date posted" : filterBy
				  }):`
				: ":"
		}
        `;
	}

	calculateDistance(
		lat1: number,
		lon1: number,
		lat2: number,
		lon2: number
	): number {
		const toRadians = (degrees: number) => degrees * (Math.PI / 180);

		const R = 3958.8; // Radius of the Earth in miles
		const dLat = toRadians(lat2 - lat1);
		const dLon = toRadians(lon2 - lon1);
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(toRadians(lat1)) *
				Math.cos(toRadians(lat2)) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const distance =
			(lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)
				? -1
				: R * c;
		return distance;
	}

	async queryCoordinates(location: string): Promise<any> {
		const preferredCity = encodeURIComponent(location);

		const baseURL = `https://maps.google.com/maps/api/geocode/json?address=${preferredCity}&components=country:US&key=${MAP_KEY}`;
		const response = await axios.get(baseURL);
		const coordinates: { lat: number; lng: number } = {
			lat: response.data.results[0].geometry.location.lat,
			lng: response.data.results[0].geometry.location.lng,
		};

		return coordinates;
	}
}
