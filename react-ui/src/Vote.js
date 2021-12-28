import React, { useState, useCallback, useEffect } from 'react';
import VoteForm from './VoteForm';

function Vote(props) {

  const [votes, setVotes] = useState([]);
  const [myVotes, setMyVotes] = useState([]);

  const fetchData = useCallback(() => {
    fetch("/api/votes/")
      .then(response => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json();
      })
      .then(json => {
        setVotes(json)
      }).catch(e => {
        console.log(e);
      })

    fetch("/api/votes/mine")
      .then(response => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json();
      })
      .then(json => {
        setMyVotes(json)
      }).catch(e => {
        console.log(e);
      })
  });





  const handleOnSubmit = (game) => {
    console.log(JSON.stringify({...game}))
      fetch("/api/vote", {
            method: "POST",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({...game})
        });
  };

  useEffect(() => {
    fetchData();
  }, []);


  return votes.map( function(vote){ 
    return (
        <VoteForm handleOnSubmit={handleOnSubmit} game={vote} isAdmin={props.isAdmin} existingVote={myVotes.filter(v => v.id === vote.id)[0]?.rank}/>
     );
    });

}

export default Vote;