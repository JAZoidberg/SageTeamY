import axios from 'axios';
import { APP_ID, APP_KEY } from '@root/config';


export function adzunaAPI(): void {
	// Define the structure of a job listing
	interface JobListing {
		title: string;
		company: string;
		location: string;
		salary: string;
		link: string;
		description: string;
	}

		// Define the cache type
		type JobCache = {
			[key: string]: JobListing[];
		};

		// Create a cache object to store results
		const jobCache: JobCache = {};

		// Define the getJobs function with caching
		const getJobs = async (JOB_TITLE: string, LOCATION: string): Promise<JobListing[]> => {
			const cacheKey = `${JOB_TITLE.toLowerCase()}-${LOCATION.toLowerCase()}`;

			// Check if the data is already in the cache
			if (jobCache[cacheKey]) {
				console.log('Fetching data from cache...');
				return jobCache[cacheKey];
			}

			// URL for the API request
			const URL = `https://api.adzuna.com/v1/api/jobs/${LOCATION}/search/1?app_id=${APP_ID}&app_key=${APP_KEY}
				&results_per_page=10&what=${encodeURIComponent(JOB_TITLE)}&where=${encodeURIComponent(LOCATION)}`;

			try {
				// Make the API request
				console.log('Fetching data from API...');
				const response = await axios.get(URL);

				// Format the job listings
				const jobListings: JobListing[] = response.data.results.map((job: any) => ({
					title: job.title,
					company: job.company?.name || 'Not Provided',
					location: job.location?.display_name || 'Not Provided',
					salary: job.salary_min
						? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}`
						: 'Salary not listed',
					link: job.redirect_url || 'No link available',
					description: job.description || 'No description available'
				}));

				// Store the formatted data in the cache
				jobCache[cacheKey] = jobListings;

				// Return the data
				return jobListings;
			} catch (error) {
				console.error('Axios error:', error);
				throw error;
			}
		};

	//  Usage example
	// getJobs('software engineer', 'US')
	// 	.then((data) => console.log('Job Listings:', data))
	// 	.catch((err) => console.error(err));
}
