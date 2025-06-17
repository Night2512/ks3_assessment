document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const infoCollectionDiv = document.getElementById('infoCollection');
    const infoForm = document.getElementById('infoForm');
    const assessmentSectionDiv = document.getElementById('assessmentSection');
    const assessmentForm = document.getElementById('assessmentForm');
    const resultsDiv = document.getElementById('results');
    const detailedResultsDiv = document.getElementById('detailedResults');
    const overallScoreElement = document.getElementById('overallScore');
    const overallExpectationsElement = document.getElementById('overallExpectations');
    const timerDisplay = document.getElementById('time');
    const sendEmailBtn = document.getElementById('sendEmailBtn'); // This button will be hidden anyway
    const emailStatus = document.getElementById('emailStatus');
    const submitAssessmentBtn = document.getElementById('submitAssessmentBtn'); // Assuming you've added this ID to your submit button in index.html

    // --- User Info Storage ---
    let parentName = '';
    let childName = '';
    let parentEmail = '';
    let assessmentTextResults = '';
    let assessmentHtmlResults = '';
    const CURRENT_KEY_STAGE = "Key Stage 3"; // Or "Key Stage 2", "Key Stage 1" depending on the file

    // --- Timer Variables ---
    const totalTime = 15 * 60; // 30 minutes in seconds (CHANGED FOR KS3)
    let timeLeft = totalTime;
    let timerInterval;

    // --- Assessment Data (UPDATED FOR KS3) ---
    const correctAnswers = {
        // English (Q1-Q15)
        q1: 'Although it was raining',
        q2: 'The cat was chased by the dog.',
        q3: 'b', // Her smile was as bright as the sun.
        q4: 'The teacher asked, "Who was ready for the test?"', // Or "The teacher asked, 'Who was ready for the test?'"
        q5: 'c', // malevolent
        q6: 'He doesn\'t like broccoli.',
        q7: 'un',
        q8: 'a', // I like apples; she likes oranges.
        q9: 'a',
        q10: 'tall',
        q11: 'a', // buy
        q12: 'b',
        q13: 'necessary',
        q14: 'The sun was setting, and the sky turned orange.', // Or "The sun was setting; the sky turned orange."
        q15: 'a', // affect

        // Maths (Q16-Q30)
        q16: '2a + 7b',
        q17: 4,     // 2x + 7 = 15 => 2x = 8 => x = 4
        q18: 125,   // 5 * 5 * 5
        q19: 60,    // (3/5) * 100
        q20: '3/10', // 3 blue out of 10 total
        q21: 40,    // 8 * 5
        q22: 75,    // 0.75 as a percentage
        q23: 48,    // 60 * 0.80
        q24: 135,   // (8-2)*180/8
        q25: '6x + 6', // 2x + 6 + 4x
        q26: 3.14, // Pi to two decimal places
        q27: 50,    // 5 cm * 1000 = 5000 cm = 50 m
        q28: 24,    // 4 * 3 * 2
        q29: 25,    // Squares: 1^2, 2^2, 3^2, 4^2, 5^2
        q30: 'x < 5' // 3x < 15 => x < 5
    };

    // All questions are 1 point for simplicity, making total score out of 30.
    const questionPoints = {
        q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1, q7: 1, q8: 1, q9: 1, q10: 1,
        q11: 1, q12: 1, q13: 1, q14: 1, q15: 1, q16: 1, q17: 1, q18: 1, q19: 1, q20: 1,
        q21: 1, q22: 1, q23: 1, q24: 1, q25: 1, q26: 1, q27: 1, q28: 1, q29: 1, q30: 1
    };

    // --- Turnstile Callbacks (Global functions for the widget) ---
    // These functions are called by Cloudflare's Turnstile script
    window.turnstileCallback = function(token) {
        submitAssessmentBtn.disabled = false; // Enable the submit button when Turnstile is solved
        emailStatus.textContent = 'Security check complete. You can now submit.';
        emailStatus.style.color = '#28a745';
    };

    window.turnstileErrorCallback = function() {
        submitAssessmentBtn.disabled = true; // Keep button disabled on error
        emailStatus.textContent = 'Security check failed. Please try again or refresh.';
        emailStatus.style.color = '#dc3545';
    };

    // --- Event Listeners ---
    infoForm.addEventListener('submit', function(event) {
        event.preventDefault();
        parentName = document.getElementById('parentName').value.trim();
        childName = document.getElementById('childName').value.trim();
        parentEmail = document.getElementById('parentEmail').value.trim();
        if (parentName && childName && parentEmail) {
            infoCollectionDiv.style.display = 'none';
            assessmentSectionDiv.style.display = 'block';
            startTimer();
            // Initialize Turnstile widget if it's not already rendered (e.g., if using explicit render)
            // If using data-sitekey and not explicit render, it should already be there.
        } else {
            alert('Please fill in all required information.');
        }
    });

    assessmentForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent default form submission

        clearInterval(timerInterval); // Stop the timer immediately

        // Get Turnstile token from the hidden input generated by the widget
        const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]').value;

        if (!turnstileResponse) {
            alert('Please complete the security check (Cloudflare Turnstile) before submitting.');
            emailStatus.textContent = 'Please complete the security check.';
            emailStatus.style.color = '#dc3545';
            submitAssessmentBtn.disabled = true; // Ensure button is disabled if token is missing
            return;
        }

        // Send Turnstile token to a Netlify function for verification
        emailStatus.textContent = 'Verifying security check...';
        emailStatus.style.color = '#007bff';
        submitAssessmentBtn.disabled = true; // Disable button during verification

        try {
            const response = await fetch('/.netlify/functions/verify-turnstile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ turnstileToken: turnstileResponse }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                emailStatus.textContent = 'Security check passed! Submitting assessment...';
                emailStatus.style.color = '#28a745';
                submitAssessmentBtn.disabled = false; // Re-enable for visual consistency before proceeding
                submitAssessment(); // Proceed with assessment submission and email
            } else {
                console.error('Turnstile verification failed:', data.errors || data.message);
                emailStatus.textContent = `Security check failed: ${data.message || 'Unknown error'}. Please try again.`;
                emailStatus.style.color = '#dc3545';
                submitAssessmentBtn.disabled = true; // Keep disabled on failure
                // Reset Turnstile widget to allow the user to try again
                if (typeof turnstile !== 'undefined') {
                    turnstile.reset();
                }
            }
        } catch (error) {
            console.error('Error during Turnstile verification:', error);
            emailStatus.textContent = 'Network error during security check. Please try again.';
            emailStatus.style.color = '#dc3545';
            submitAssessmentBtn.disabled = true; // Keep disabled on error
            if (typeof turnstile !== 'undefined') {
                turnstile.reset();
            }
        }
    });

    // --- Functions ---

    function startTimer() {
        timerInterval = setInterval(() => {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                // When timer runs out, programmatically submit the assessment form.
                // The Turnstile check will be performed as part of the form submission handler.
                assessmentForm.requestSubmit();
            }
        }, 1000);
    }

    function submitAssessment() {
        let totalScore = 0;
        detailedResultsDiv.innerHTML = ''; // Clear previous results
        assessmentTextResults = `--- Key Stage 3 Assessment Results for ${childName} (Parent: ${parentName}) ---\n\n`;
        assessmentHtmlResults = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; }
                    h2, h3, h4 { color: #0056b3; }
                    .question-item { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #eee; }
                    .question-item:last-child { border-bottom: none; }
                    .score-summary { text-align: center; margin-top: 25px; padding-top: 15px; border-top: 2px solid #007bff; }
                    .correct { color: green; }
                    .incorrect { color: red; }
                    .expectation-meets { color: #28a745; font-weight: bold; }
                    .expectation-below { color: #dc3545; font-weight: bold; }
                    .expectation-above { color: #007bff; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Key Stage 3 Assessment Results</h2>
                    <p><strong>Parent Name:</strong> ${parentName}</p>
                    <p><strong>Child Name:</strong> ${childName}</p>
                    <p><strong>Parent Email:</strong> ${parentEmail}</p>
                    <hr>
                    <h3>Detailed Results:</h3>
        `;

        const questions = Array.from({length: 30}, (_, i) => `q${i + 1}`); // Generates ['q1', 'q2', ..., 'q30']

        questions.forEach(qId => {
            let userAnswer;
            let isCorrect = false;
            let score = 0;
            const correctAns = correctAnswers[qId];
            const maxPoints = questionPoints[qId];
            let outcomeText = ''; // Changed from expectationText for individual questions
            let outcomeClass = ''; // Changed from expectationClass for individual questions

            const qElement = document.getElementById(qId);
            const questionTitle = qElement ? qElement.querySelector('h3').textContent : `Question ${qId.toUpperCase()}`;

            // Determine user answer based on input type
            const inputField = document.querySelector(`[name="${qId}_answer"]`);
            if (!inputField) {
                userAnswer = 'N/A (Input field not found)';
                isCorrect = false;
            } else if (inputField.type === 'radio') {
                const selectedRadio = document.querySelector(`input[name="${qId}_answer"]:checked`);
                userAnswer = selectedRadio ? selectedRadio.value : 'No Answer';
                isCorrect = (userAnswer === correctAns);
            } else if (inputField.tagName === 'TEXTAREA') { // For Q9
                userAnswer = inputField.value.trim();
                // For textarea, a simple includes check for core keywords
                // This is a basic check; for real assessments, manual review or more robust NLP might be needed.
                isCorrect = String(correctAns).split(' ').every(word => userAnswer.toLowerCase().includes(word.toLowerCase()));
            } else if (inputField.type === 'text') {
                userAnswer = inputField.value.trim();
                // Specific handling for answers requiring exact case or phrasing
                if (qId === 'q2' || qId === 'q4' || qId === 'q6' || qId === 'q14' || qId === 'q16' || qId === 'q25' || qId === 'q30') {
                    isCorrect = (userAnswer === correctAns); // Exact match
                } else {
                    isCorrect = (userAnswer.toLowerCase() === String(correctAns).toLowerCase()); // Case-insensitive
                }
            } else if (inputField.type === 'number') {
                userAnswer = parseFloat(inputField.value); // Use parseFloat for potential decimals like Q26
                isCorrect = (userAnswer === correctAns);
            }

            if (isCorrect) {
                score = maxPoints;
                totalScore += score;
                outcomeText = 'Correct';
                outcomeClass = 'correct';
            } else {
                score = 0;
                outcomeText = 'Incorrect';
                outcomeClass = 'incorrect';
            }

            // Append detailed results to the HTML for display on page
            detailedResultsDiv.innerHTML += `
                <div class="result-item">
                    <h4>${questionTitle}</h4>
                    <p><strong>Your Answer:</strong> ${userAnswer}</p>
                    <p><strong>Correct Answer:</strong> ${correctAns}</p>
                    <p><strong>Score:</strong> ${score}/${maxPoints}</p>
                    <p><strong>Outcome:</strong> <span class="${outcomeClass}">${outcomeText}</span></p>
                </div>
            `;

            // Append detailed results to the plain text summary for email
            assessmentTextResults += `Question: ${questionTitle}\n`;
            assessmentTextResults += `   Your Answer: ${userAnswer}\n`;
            assessmentTextResults += `   Correct Answer: ${correctAns}\n`;
            assessmentTextResults += `   Score: ${score}/${maxPoints}\n`;
            assessmentTextResults += `   Outcome: ${outcomeText}\n\n`;

            // Append detailed results to the HTML summary for email
            assessmentHtmlResults += `
                <div class="question-item">
                    <h4>${questionTitle}</h4>
                    <p><strong>Your Answer:</strong> ${userAnswer}</p>
                    <p><strong>Correct Answer:</strong> ${correctAns}</p>
                    <p><strong>Score:</strong> ${score}/${maxPoints}</p>
                    <p><strong>Outcome:</strong> <span class="${outcomeClass}">${outcomeText}</span></p>
                </div>
            `;
        });

        overallScoreElement.textContent = `Overall Score: ${totalScore}/30`; // Updated max score
        assessmentTextResults += `\nOverall Score: ${totalScore}/30\n`;

        let overallExpectations = '';
        let overallExpectationsClass = '';
        // Adjusted thresholds for KS3 (Example thresholds for a 30-point assessment)
        if (totalScore >= 23) { // ~77% and above
            overallExpectations = 'Above Expectations (Excellent understanding)';
            overallExpectationsClass = 'expectation-above';
        } else if (totalScore >= 15) { // ~50% to 76%
            overallExpectations = 'Meets Expectations (Good understanding)';
            overallExpectationsClass = 'expectation-meets';
        } else { // Below 50%
            overallExpectations = 'Below Expectations (Needs more support)';
            overallExpectationsClass = 'expectation-below';
        }
        overallExpectationsElement.innerHTML = `Overall Outcome: <span class="${overallExpectationsClass}">${overallExpectations}</span>`;
        assessmentTextResults += `Overall Outcome: ${overallExpectations}\n`;

        // End of assessmentHtmlResults string
        assessmentHtmlResults += `
                    <div class="score-summary">
                        <h3>Overall Score: ${totalScore}/30</h3>
                        <h3>Overall Outcome: <span class="${overallExpectationsClass}">${overallExpectations}</span></h3>
                    </div>
                    <p>If you have any questions, please reply to this email.</p>
                    <p>Best regards,<br/>Mona Teaches</p>
                </div>
            </body>
            </html>
        `;

        assessmentSectionDiv.style.display = 'none'; // Hide assessment form
        resultsDiv.style.display = 'block';   // Show results

        // --- Auto-send email and hide the button ---
        sendEmailBtn.style.display = 'none'; // Hide the button
        sendAssessmentEmail(parentName, childName, parentEmail, assessmentTextResults, assessmentHtmlResults);
    }

    // --- Send Email Function (Client-side, calls Netlify Function) ---
    async function sendAssessmentEmail(parentName, childName, parentEmail, resultsText, resultsHtml) {
        emailStatus.textContent = 'Sending email...';
        emailStatus.style.color = '#007bff';

        try {
            const response = await fetch('/.netlify/functions/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    parentName: parentName,
                    childName: childName,
                    parentEmail: parentEmail,
                    resultsText: resultsText,
                    resultsHtml: resultsHtml,
                    keyStage: CURRENT_KEY_STAGE
                }),
            });

            if (response.ok) {
                emailStatus.textContent = 'Email sent successfully!';
                emailStatus.style.color = '#28a745';
            } else {
                const errorData = await response.json();
                console.error('Error sending email:', errorData.message);
                emailStatus.textContent = `Failed to send email: ${errorData.message || 'Server error'}`;
                emailStatus.style.color = '#dc3545';
            }
        } catch (error) {
            console.error('Network or unexpected error:', error);
            emailStatus.textContent = `Failed to send email: Network error`;
            emailStatus.style.color = '#dc3545';
        }
    }
});