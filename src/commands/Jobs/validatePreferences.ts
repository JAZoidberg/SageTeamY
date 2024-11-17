interface ValidateResult {
	isValid: boolean;
	error: string[];
}

export const validatePreferences = (answers: string[], qset: number, isJobForm: boolean): ValidateResult => {
	const errors: string[] = [];
	if (qset === 0) {
		const [city, workType, employmentType, travelDistance] = answers;
		if (!city?.trim()) errors.push('Enter valid city');
		if (!workType?.trim()) {
			errors.push('Enter valid work type');
		} else {
			const validWorkTypes = ['remote', 'hybrid', 'in-person'];
			// eslint-disable-next-line id-length
			const workTypes = workType.toLowerCase().split(',').map(t => t.trim());
			// eslint-disable-next-line id-length
			const invalidTypes = workTypes.filter(t => !validWorkTypes.includes(t));
			if (invalidTypes.length > 0) {
				errors.push(`Invalid work type: ${invalidTypes.join(', ')}. Must be remote, hybrid, and/or in-person`);
			}
		}
		if (!employmentType?.trim()) {
			errors.push('Enter valid employment type');
		} else {
			const validEmploymentTypes = ['full time', 'part time', 'internship'];
			// eslint-disable-next-line id-length
			const employmentTypes = employmentType.toLowerCase().split(',').map(t => t.trim());
			// eslint-disable-next-line id-length
			const invalidTypes = employmentTypes.filter(t => !validEmploymentTypes.includes(t));
			if (invalidTypes.length > 0) {
				errors.push(`Invalid work type: ${invalidTypes.join(', ')}. Must be full time, part time, and/or internship`);
			}
		}
		if (!travelDistance?.trim()) errors.push('Enter valid travel distance');
	}
};
