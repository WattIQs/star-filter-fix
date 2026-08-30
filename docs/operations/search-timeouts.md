# Search timeout contract

External geodata providers must always be called with an abortable timeout. Provider failures must fall through to the next configured provider and must not leave the request pending indefinitely.
