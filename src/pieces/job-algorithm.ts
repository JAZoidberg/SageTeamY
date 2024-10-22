export default function jobSearchAlgorithm(jobAnswers) {
	// May need to handle case inside of tasks.ts where the bot informs the user that at the moment the user has no personalized job specifications because they haven't filled out the job form (make sure to provide the user the command to utilize it)

	// If they have filled out the job form, they'll receive catered job searches based on the input they provided to the form; may need to store that info in the database so that it doesn't get forgotten and stays unique for each user
	console.log("IN ALGO:", jobAnswers);
}
