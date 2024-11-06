import { JobPreferences } from '../commands/jobs/APIDatabase';

export default function jobSearchAlgorithm(jobAnswers:JobPreferences[], userID:string) {
	console.log('jobSearchAlgorithm', jobAnswers);
	console.log('jobSearchAlgorithm', userID);
	// eslint-disable-next-line max-len
	// May need to handle case inside of tasks.ts where the bot informs the user that at the moment the user has no personalized job specifications because they haven't filled out the job form (make sure to provide the user the command to utilize it)

	// eslint-disable-next-line max-len
	// If they have filled out the job form, they'll receive catered job searches based on the input they provided to the form; may need to store that info in the database so that it doesn't get forgotten and stays unique for each user
}
