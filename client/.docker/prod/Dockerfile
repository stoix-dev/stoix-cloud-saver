# Use the latest Node.js image
FROM node:latest

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the application's files into the container
COPY . .

# Install production dependencies
RUN npm install 

# Build the application
RUN npm run build


# Expose ports 80
EXPOSE 80 

# Define the command to run the app
CMD ["npm", "run", "start"]
