import React, { useCallback, useEffect, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import logo from './logo.svg';
import './App.css';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from "react-router-dom";

function App() {

  const [username, setUsername] = useState("");

  const fetchData = useCallback(() => {
    fetch("/account")
      .then(response => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json();
      })
      .then(json => {
        if (json.username){
          setUsername(`${json.username}#${json.discriminator}`);
        }
      }).catch(e => {
        console.log(e);
      })
  });

  useEffect(() => {
    fetchData();
  });

  return (
    <div className="App">
    <Router>
      <Navbar bg="light" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/">OGA Prediction League</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/">Home</Nav.Link>
              <Nav.Link as={Link} to="/about">About</Nav.Link>
              <Nav.Link as={Link} to="/users">Users</Nav.Link>
            </Nav>
          </Navbar.Collapse>
              <Navbar.Collapse className="justify-content-end">
            <Navbar.Text>
              { username ? `Logged in as ${username}` : <a href="/login">Login</a> }
            </Navbar.Text>
          </Navbar.Collapse>
        </Container>
      </Navbar>      

      {/* A <Routes> looks through its children <Route>s and
          renders the first one that matches the current URL. */}
      <Routes>
        <Route path="/about" element={<About/>} />
      </Routes>        
      <Routes>
        <Route path="/" element={<Home/>} />
      </Routes>        
      <Routes>
        <Route path="/users" element={<Users/>} />
      </Routes>        
    </Router>
    </div>
  );

}

function Home() {
  const [message, setMessage] = useState(null);
  const [url] = useState('/api');
  const [isFetching, setIsFetching] = useState(false);
  const fetchData = useCallback(() => {
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json();
      })
      .then(json => {
        setMessage(json.message);
        setIsFetching(false);
      }).catch(e => {
        setMessage(`API call failed: ${e}`);
        setIsFetching(false);
      })
  }, [url]);

  useEffect(() => {
    setIsFetching(true);
    fetchData();
  }, [fetchData]);

  return  (<header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        { process.env.NODE_ENV === 'production' ?
            <p>
              This is a production build from create-react-app.
            </p>
          : <p>
              Edit <code>src/App.js</code> and save to reload.
            </p>
        }
        <p>{'« '}<strong>
          {isFetching
            ? 'Fetching message from API'
            : message}
        </strong>{' »'}</p>
        <p><a
          className="App-link"
          href="https://github.com/mars/heroku-cra-node"
        >
          React + Node deployment on Heroku
        </a></p>
        <p><a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a></p>
      </header>)
    };


function About() {
  return <header className="App-header"><h2>About2</h2></header>;
}

function Users() {
  return <header className="App-header"><h2>Users</h2></header>;
}


export default App;
