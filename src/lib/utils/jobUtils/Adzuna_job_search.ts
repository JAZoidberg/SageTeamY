import { APP_ID, APP_KEY } from '@root/config';
// import axios from 'axios';


// Questions: how to pull it? Do I need to pull it?
// how to work on the next part of the project?
// Task 3.5: Store fetched job listings temporarily for job matching
// Create a local cache or temporary storage to hold job listings for processing.
export function adzunaAPI(): void {
	const JOB_TITLE = 'software engineer';
	const LOCATION = 'us';
	// const SALARY_MIN = 50000;

	const URL = `https://api.adzuna.com/v1/api/jobs/${LOCATION}/search/1?app_id=${APP_ID}&app_key=${APP_KEY}
	&results_per_page=10&what=${encodeURIComponent(JOB_TITLE)}&where=${encodeURIComponent(LOCATION)}`;

	fetch(URL)
		.then((response) => {
			if (!response.ok) {
				throw new Error(`HTTP error ${response.status}`);
			}
			return response.json();
		})
		.then((responseData) => {
			console.log('got data');
		// console.log(responseData);
		})
		.catch((error) => {
			console.error('Fetch error:', error);
		});
}
