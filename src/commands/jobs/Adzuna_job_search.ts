import { APP_ID, APP_KEY } from '@root/config';

const JOB_TITLE = 'software engineer';
const LOCATION = 'us';

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
		console.log(responseData);
	})
	.catch((error) => {
		console.error('Fetch error:', error);
	});
