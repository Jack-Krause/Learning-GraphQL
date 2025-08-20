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
      reviews(episode: Episode!): [Review!]!
      allReviews: [Review!]!
    }


    type Review {
      episode: Episode!
      stars: Int!
      comment: String
    }

    input ReviewInput {
      stars: Int!
      comment: String
    }

    type Mutation {
      createReview(episode: Episode!, review: ReviewInput!): Review!
      updateReviewStars(episode: Episode!, stars: Int!, comment: String): Review!
      deleteCharacter(id: ID!): ID!
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


const reviews = [
  { episode: "NEWHOPE", stars: 0, comment: "a new hope" },
  { episode: "EMPIRE",  stars: 0, comment: "the empire strikes back" },
  { episode: "JEDI",    stars: 0, comment: "return of the jedi" }
];


const getAllCharacters = () => ([
  ...humans.map(h => ({...h, __type: "Human"})),
  ...droids.map(d => ({...d, __type: "Droid"})),
]);


const getCharacterById = (id) => {
  const h = humans.find(x => x.id === id);
  if (h) return {...h, __type: "Human"};
  const d = droids.find(x => x.id === id);
  if (d) return {...d, __type: "Droid"};
  return null;
}

const shipById = new Map(starships.map(s => [s.id, s]));

// const allCharacters = [...humans.map(h => ({ ...h, __type: "Human" })), ...droids.map(d => ({ ...d, __type: "Droid" }))];
// const byId = new Map(allCharacters.map(c => [c.id, c]));
// const shipById = new Map(starships.map(s => [s.id, s]));


// Resolvers map: types -> fields
const resolvers = {
  Query: {
    // Called for: query { starship(id: "...") { ... } }
    starship: (_, { id }) => starships.find(s => s.id === id) || null,
    character: (_, { id }) => getCharacterById(id),
    characters: () => getAllCharacters(),
    reviews: (_, { episode }) => reviews.filter(review => review.episode === episode),
    allReviews: () => reviews,
  },

  Mutation: { 
    createReview: (_, { episode, review }) => {
      if (review.stars < 0 || review.stars > 5) {
        throw new Error("invalid number of stars [0, 5]");
      }

      const r = {
        episode,
        stars: review.stars,
        comment: review.comment ?? null
      }

      reviews.push(r);
      console.info(`Review updated for ${episode} to ${r.stars} stars.`)
      return r;
    },

    updateReviewStars: (_, { episode, stars, comment }) => {
      if (stars < 0 || stars > 5) {
        throw new Error("invalid number of stars [0, 5]");
      }

      const r = reviews.find((rev) => rev.episode === episode);
      if (! r) {
        throw new Error(`no review found for episode: ${episode}`);
      }

      r.stars = stars;
      if (typeof comment !== "undefined") {
        r.comment = comment;
      }

      return r;
    },

    deleteCharacter: (_, {id}) => {
      const hIdx = humans.findIndex(h => h.id === id);
      const dIdx = droids.findIndex(d => d.id === id);

      if (hIdx === -1 && dIdx === -1) {
        throw new Error(`no character found with id: ${id}`);
      }

      if (hIdx !== -1) humans.splice(hIdx, 1);
      if (dIdx !== -1) droids.splice(dIdx, 1);

      for (const h of humans) {
        h.friendIds = (h.friendIds || []).filter(fid => fid !== id);
      }

      for (const d of droids) {
        d.friendIds = (d.friendIds || []).filter(fid => fid !== id);
      }
      
      return id;
    },
    

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
    friends: (human) => (human.friendIds || []).map(getCharacterById),
    starships: (human) => human.starshipIds?.map(id => shipById.get(id)) || []
  },

  Droid: {
    friends: (droid) => (droid.friendIds || []).map(getCharacterById),
  }

};

// Boot the server
const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, { listen: { port: 4000 } });
console.log(`🚀 Server ready at ${url}`);

