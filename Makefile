CC = gcc
CFLAGS = -Wall -Wextra -Iinclude -std=c99
LDFLAGS = -lm

SRC = src/main.c src/csv_parser.c src/analytics.c
OBJ = $(SRC:.c=.o)
TARGET = data_analyzer

all: $(TARGET)

$(TARGET): $(OBJ)
	$(CC) $(CFLAGS) -o $(TARGET) $(OBJ) $(LDFLAGS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f src/*.o $(TARGET) $(TARGET).exe
