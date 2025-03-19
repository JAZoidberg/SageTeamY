import { ApplicationCommandOptionData, ApplicationCommandOptionType, ChatInputCommandInteraction, EmbedBuilder, InteractionResponse, Message } from 'discord.js';
import fetchJobListings from '@root/src/lib/utils/jobUtils/Adzuna_job_search';
import { JobResult } from '@root/src/lib/types/JobResult';
import { Interest } from '@root/src/lib/types/Interest';
import { JobData } from '@root/src/lib/types/JobData';
import { Command } from '@lib/types/Command';
import { DB, BOT } from '@root/config';
import { Job } from '@root/src/lib/types/Job';
import { MongoClient } from 'mongodb';


export default class extends Command {

	description = `Get a listing of jobs based on your interests and preferences.`;
	extendedHelp = `This command will return a listing of jobs based on your interests and preferences.`;

	// options: ApplicationCommandOptionData[] = [
	// 	{
	// 		name: 'question',
	// 		description: 'The question you want to ask',
	// 		type: ApplicationCommandOptionType.String,
	// 		required: true
	// 	}
	// ]

	// options: ApplicationCommandOptionData[] = [
	// 	{
	// 		name: 'filter Options',
	// 		description: 'Filter options for job listings',
	// 		type: ApplicationCommandOptionType.String,
	// 		required: false,
	// 		choices: [
	// 			{
	// 				name: 'Date',
	// 				value: 'date'
	// 			},
	// 			{
	// 				name: 'Salary',
	// 				value: 'salary'
	// 			},
	// 			{
	// 				name: 'Alphabetical',
	// 				value: 'alphabetical'
	// 			}
	// 		]
	// 	}
	// ]

	async run(interaction: ChatInputCommandInteraction): Promise<void | InteractionResponse<boolean>> {
		const userID = interaction.user.id;

		const client = await MongoClient.connect(DB.CONNECTION, { useUnifiedTopology: true });
		const db = client.db(BOT.NAME).collection(DB.JOB_FORMS);
		const jobformAnswers:Job[] = await db.find({ owner: userID }).toArray();
		// const jobData:JobData = {
		// 	city: jobformAnswers[0].answers[0],
		// 	preference: jobformAnswers[0].answers[1],
		// 	jobType: jobformAnswers[0].answers[2],
		// 	distance: jobformAnswers[0].answers[3],
		// 	// filterBy: filterBy ?? 'default'
		// 	filterBy: 'default'
		// };

		// const interests:Interest = {
		// 	interest1: jobformAnswers[1].answers[0],
		// 	interest2: jobformAnswers[1].answers[1],
		// 	interest3: jobformAnswers[1].answers[2],
		// 	interest4: jobformAnswers[1].answers[3],
		// 	interest5: jobformAnswers[1].answers[4]
		// };

		const jobData: JobData = {
			city: 'New York',
			preference: 'Software Engineer',
			jobType: 'Full Time',
			distance: '10',
			filterBy: 'date'
		};

		const interests: Interest = {
			interest1: 'Software',
			interest2: 'Engineer',
			interest3: 'Full Time',
			interest4: 'New York',
			interest5: '10'
		};


		const APIResponse:JobResult[] = await fetchJobListings(jobData, interests);
		/**const results = [jobData, interests, APIResponse];
		const jobFormData: [JobData, Interest, JobResult[]] = [jobData, interests, APIResponse];
			// the tabs are being counted for some reason so thats why its formatted so weirdly in code !!
		let message = `## Hey <@${userID}>!  
			## Here's your list of job/internship recommendations: \n  
		Based on your interests in...
			\n\t* working as a: **${jobFormData[1].interest1}** **${jobFormData[1].interest2}**, \n\t*  being this job type: **${jobFormData[1].interest3}**, \n\t*  based in or around: **${jobFormData[1].interest4}**, \n\t*  and within this distance: **${jobFormData[1].interest5}**, \n 
	I've found these jobs you may find interesting. Please note that while you may get job/internship recommendations from the same company, \n their positions/details/applications/salary WILL be different and this is not a glitch/bug!\n
	Here's your personalized list:

			${this.listJobs(jobFormData[2], 'date')}
			
			---  
			### **Disclaimer:**  
			-# Please be aware that the job listings displayed are retrieved from a third-party API. \
			While we strive to provide accurate information, we cannot guarantee the legitimacy or security\
			of all postings. Exercise caution when sharing personal information, submitting resumes, or registering\
			on external sites. Always verify the authenticity of job applications before proceeding. Additionally, \
			some job postings may contain inaccuracies due to API limitations, which are beyond our control. We apologize for any inconvenience this may cause and appreciate your understanding.
			`;

		if (message.length > 2000) {
			message = `${message.substring(0, 1997)}...`;
		}

		const pubChan = interaction.channel;
		if (pubChan) {
			pubChan.send({ content: message });
		} else {
			console.error('Channel not found');
		}
	}

	listJobs(jobData: JobResult[], filterBy: string): string {
		// Conditionally sort jobs by salary if sortBy is 'salary'
		if (filterBy === 'salary') {
			jobData.sort((a, b) => {
				const avgA = (Number(a.salaryMax) + Number(a.salaryMin)) / 2;
				const avgB = (Number(b.salaryMax) + Number(b.salaryMin)) / 2;
	
				// Handle cases where salaryMax or salaryMin is "Not listed"
				if (isNaN(avgA)) return 1; // Treat jobs with no salary info as lowest
				if (isNaN(avgB)) return -1;
	
				return avgB - avgA; // Descending order
			});
		}
	
		let jobList = '';
		for (let i = 0; i < jobData.length; i++) {
			const avgSalary = (Number(jobData[i].salaryMax) + Number(jobData[i].salaryMin)) / 2;
			const formattedAvgSalary = this.formatCurrency(avgSalary);
			const formattedSalaryMax = this.formatCurrency(Number(jobData[i].salaryMax)) !== 'N/A' ? this.formatCurrency(Number(jobData[i].salaryMax)) : '';
			const formattedSalaryMin = this.formatCurrency(Number(jobData[i].salaryMin)) !== 'N/A' ? this.formatCurrency(Number(jobData[i].salaryMin)) : '';
	
			const salaryDetails = (formattedSalaryMin && formattedSalaryMax)
				? `, Min: ${formattedSalaryMin}, Max: ${formattedSalaryMax}`
				: formattedAvgSalary;
	
			jobList += `${i + 1}. **${jobData[i].title}**  
			  \t\t* **Salary Average:** ${formattedAvgSalary}${salaryDetails}  
			  \t\t* **Location:** ${jobData[i].location}  
			  \t\t* **Apply here:** [read more about the job and apply here](${jobData[i].link})  
			  ${i !== jobData.length - 1 ? '\n' : ''}`;
		}
	
		return jobList || '### Unfortunately, there were no jobs found based on your interests :(. Consider updating your interests or waiting until something is found.';
	}

	formatCurrency(currency: number): string {
		return isNaN(currency) ? 'N/A' : `${new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(Number(currency))}`;
	}
		**/
		const slides = APIResponse.map((job, index) => {
            return new EmbedBuilder()
                .setTitle(`Job ${index + 1}: ${job.title}`)
                .setDescription(`**Location:** ${job.location}\n**Salary:** ${this.formatCurrency((Number(job.salaryMax) + Number(job.salaryMin)) / 2)}\n**Location: **${job.location}\n **Apply here:** [read more about the job and apply here](${job.link})`)
                .setThumbnail('https://www.google.com/url?sa=i&url=https%3A%2F%2Fwww.bls.gov%2Fcareeroutlook%2F2022%2Farticle%2Foccupations-that-dont-require-a-degree.htm&psig=AOvVaw3Ms_wesjZ5jFHFBXW0GYcm&ust=1742454090155000&source=images&cd=vfe&opi=89978449&ved=0CBQQjRxqFwoTCPiNsrrJlYwDFQAAAAAdAAAAABAE') // Update this URL to match your server setup
                .setColor('#0099ff');
        });

        let slideIndex = 0;

        const message = await interaction.reply({ embeds: [slides[slideIndex]], fetchReply: true }) as Message;

        await message.react('◀');
        await message.react('▶');

        const filter = (reaction: any, user: any) => ['◀', '▶'].includes(reaction.emoji.name) && !user.bot;
        const collector = message.createReactionCollector({ filter, time: 60000 });

        collector.on('collect', async (reaction, user) => {
            if (reaction.emoji.name === '◀') {
                slideIndex = slideIndex > 0 ? slideIndex - 1 : slides.length - 1;
            } else if (reaction.emoji.name === '▶') {
                slideIndex = slideIndex < slides.length - 1 ? slideIndex + 1 : 0;
            }
            await displaySlide(message, slideIndex);
            await reaction.users.remove(user.id);
        });

        async function displaySlide(message: Message, slideIndex: number) {
            await message.edit({ embeds: [slides[slideIndex]] });
        }
    }

    formatCurrency(currency: number): string {
        return isNaN(currency) ? 'N/A' : `${new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD' 
		}).format(Number(currency))}`;
	}
	
}
