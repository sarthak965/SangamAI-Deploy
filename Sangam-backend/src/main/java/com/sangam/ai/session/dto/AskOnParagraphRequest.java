package com.sangam.ai.session.dto;

import jakarta.validation.constraints.NotBlank;

public record AskOnParagraphRequest(
        @NotBlank(message = "Question cannot be blank")
        String question
) {}