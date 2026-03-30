package com.sangam.ai.session;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class ConversationNodeStatusConverter implements AttributeConverter<ConversationNode.Status, String> {

    @Override
    public String convertToDatabaseColumn(ConversationNode.Status status) {
        if (status == null) {
            return null;
        }

        return status.name().toLowerCase();
    }

    @Override
    public ConversationNode.Status convertToEntityAttribute(String value) {
        if (value == null) {
            return null;
        }

        return ConversationNode.Status.valueOf(value.toUpperCase());
    }
}
