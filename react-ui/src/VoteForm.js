import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import {
  Link
} from "react-router-dom";

const VoteForm = (props) => {
  console.log(props)

  const [game, setGame] = useState({
    name: "",
    rank: props.existingVote
  });

  useEffect(() =>{
    setGame({ ...props.game, rank: props.existingVote} || {
    name: "",
    id: ""
  })
  }, [props.game, props.existingVote])

  const [errorMsg, setErrorMsg] = useState('');
  const { name, rank, id } = game;

  const handleOnSubmit = (event) => {
    event.preventDefault();
    const values = [ rank ];
    let errorMsg = '';

    const allFieldsFilled = values.every((field) => {
      const value = `${field}`.trim();
      return value !== '' && value != 0;
    });

    if (allFieldsFilled) {
      const game = {
        name, rank, id
        };
      props.handleOnSubmit(game);
    } else {
      errorMsg = 'Please fill out all the fields.';
    }
    setErrorMsg(errorMsg);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    switch (name) {
      // TODO: VAlidation?
      // case 'name':
      //   if (value === '' || parseInt(value) === +value) {
      //     setGame((prevState) => ({
      //       ...prevState,
      //       [name]: value
      //     }));
      //   }
      //   break;
      default:
        setGame((prevState) => ({
          ...prevState,
          [name]: value
        }));
    }
  };

  return (
    <div className="main-form">
      {errorMsg && <p className="errorMsg">{errorMsg}</p>}
      Voting on {name} {props.isAdmin ? <Link to={`/game/edit/${id}`}>Edit game</Link> : ""}
      <Form onSubmit={handleOnSubmit}>
        <Form.Group controlId="rank">
          <Form.Label>Rank</Form.Label>
          <Form.Control
            className="input-control"
            type="number"
            name="rank"
            value={rank}
            placeholder="Enter predicted rank"
            onChange={handleInputChange}
          />
        </Form.Group>
        <Button variant="primary" type="submit" className="submit-btn">
          Submit
        </Button>
      </Form>
    </div>
  );
};

export default VoteForm;