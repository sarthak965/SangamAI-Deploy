package com.sangam.ai.session;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class SessionStatusConverter implements AttributeConverter<Session.Status, String> {

    @Override
    public String convertToDatabaseColumn(Session.Status status) {
        if (status == null) {
            return null;
        }

        return status.name().toLowerCase();
    }

    @Override
    public Session.Status convertToEntityAttribute(String value) {
        if (value == null) {
            return null;
        }

        return Session.Status.valueOf(value.toUpperCase());
    }
}
