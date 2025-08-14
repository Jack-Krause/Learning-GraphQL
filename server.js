import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

const typeDefs = `#graphql
    enum Episode {
      NEWHOPE
      EMPIRE
      JEDI
    }

    enum LengthUnit {
      METER
      FOOT
    }

    interface Character {
      id: ID!
      name: String!
      friends: [Character]
      appearsIn: [Episode!]!
    }

    type Droid implements Character {
      id: ID!
      name: String!
      friends: [Character]
      appearsIn: [Episode!]!
      primaryFunction: String
    }

    type Human implements Character {
      id: ID!
      name: String!
      friends: [Character]
      appearsIn: [Episode!]!
      starships: [Starship]
      credits: Int
    }

    type Starship {
      id: ID!
      name: String!
      length(unit: LengthUnit = METER): Float
    }


    type Query {
      starship(id: ID!): Starship
      character(id: ID!): Character
      characters: [Character!]!
    }
`;

const starships = [
  { id: "falcon", name: "Millennium Falcon", lengthMeters: 34.75 },
  { id: "xwing", name: "T-65 X-wing", lengthMeters: 12.5 },
];


const humans = [
  {
    id: "han",
    name: "Han Solo",
    friendIds: ["chewie"], // link by id; we resolve later
    appearsIn: ["NEWHOPE", "EMPIRE", "JEDI"],
    starshipIds: ["falcon"],
    credits: 1000
  },
  {
    id: "luke",
    name: "Luke Skywalker",
    friendIds: ["han", "r2"],
    appearsIn: ["NEWHOPE", "EMPIRE", "JEDI"],
    starshipIds: ["xwing"],
    credits: 50
  }
];


const droids = [
  {
    id: "r2",
    name: "R2-D2",
    friendIds: ["luke"],
    appearsIn: ["NEWHOPE", "EMPIRE", "JEDI"],
    primaryFunction: "Astromech"
  },
  {
    id: "chewie",
    name: "Chewbacca",
    friendIds: ["han", "luke"],
    appearsIn: ["NEWHOPE", "EMPIRE", "JEDI"],
    primaryFunction: "Co-pilot"
  }
];


const allCharacters = [
    ...humans.map(h => ({ ...h, __type: "Human"})),
    ...droids.map(d => ({ ...d, __type: "Droid"}))
];

const byId = new Map(allCharacters.map(c => [c.id, c]));
const shipById = new Map(starships.map(s => [s.id, s]));

// const allCharacters = [...humans.map(h => ({ ...h, __type: "Human" })), ...droids.map(d => ({ ...d, __type: "Droid" }))];
// const byId = new Map(allCharacters.map(c => [c.id, c]));
// const shipById = new Map(starships.map(s => [s.id, s]));


// Resolvers map: types -> fields
const resolvers = {
  Query: {
    // Called for: query { starship(id: "...") { ... } }
    starship: (_, { id }) => starships.find(s => s.id === id) || null,
    character: (_, { id }) => byId.get(id) || null,
    characters: () => allCharacters
  },

  Starship: {
    // Custom field resolver because the field has an argument (unit)
    length: (ship, { unit }) => {
      if (!ship) return null;
      const meters = ship.lengthMeters;
      return unit === "FOOT" ? meters * 3.28084 : meters; // default METER
    },
    // Note: id and name don't need resolvers because default resolver
    // will return ship.id and ship.name automatically.
  },

  Character: {
    __resolveType(obj) {
        return obj.__type; 
    }
  },

  Human: {
    friends: (human) => human.friendIds?.map(id => byId.get(id)) || [],
    starships: (human) => human.starshipIds?.map(id => shipById.get(id)) || []
  },

  Droid: {
    friends: (droid) => droid.friendIds?.map(id => byId.get(id)) || [],
  }

};

// Boot the server
const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, { listen: { port: 4000 } });
console.log(`🚀 Server ready at ${url}`);

