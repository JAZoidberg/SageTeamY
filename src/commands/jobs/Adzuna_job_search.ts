import axios from 'axios';
import { APP_ID, APP_KEY } from '@root/config'; // configuration values imported from config.ts

// Define the getJobs function to fetch and format data
// "async" means that it is a promising fuction which allows to use await
const getJobs = async (JOB_TITLE, LOCATION) => {
	const URL = `https://api.adzuna.com/v1/api/jobs/${LOCATION}/search/1?app_id=${APP_ID}&app_key=${APP_KEY}
  &results_per_page=10&what=${encodeURIComponent(JOB_TITLE)}&where=${encodeURIComponent(LOCATION)}`;

	try { // handles any error function
		// Make the API request
		const response = await axios.get(URL);
		// iterate over each job object in the results array.
		const jobListings = response.data.results.map((job) => ({
			title: job.title,
			company: job.company?.name || 'Not Provided', // Assuming company object has a 'name' field
			location: job.location?.display_name || 'Not Provided', // Assuming location object has a 'display_name' field
			salary: job.salary_min ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}` : 'Salary not listed',
			link: job.redirect_url || 'No link available',
			description: job.description || 'No description available'

		}));

		// Log the formatted job listings (see the output to console)
		console.log('Formatted Job Listings:', jobListings);
	} catch (error) {
		// Handle any errors that occur during the request
		console.error('Axios error:', error);
	}
};

// Invoke the function with specific parameters (e.g., software engineer in the US)
getJobs('software engineer', 'us');

