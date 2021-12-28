import React, { useCallback, useEffect, useState, useMemo } from 'react';
import Table from './Table'
import {
  Link
} from "react-router-dom";

function Leaderboard(props) {

  const [loadingData, setLoadingData] = useState(true);
  const columns = useMemo(() => [
    { Header: "Place",
      accessor: "whatever",
      Cell: ({ value, row }) => {
        return row.index + 1
      }
    },
    {
      Header: "User",
      accessor: "name",
      Cell: ({ value, row }) => {
        return (<React.Fragment><div> <img width="30%" style={{"marginRight":"20px"}} src={row.original.avatar} alt="Avatar" />{row.original.name}</div></React.Fragment>)
      }
    },
    { 
      Header: "RMS Prediction Error",
      accessor: "score"
    },
    { 
      Header: "Number of predictions",
      accessor: "nVotes"
    }
  ]);

  const [data, setData] = useState([]);

  const fetchData = useCallback(() => {
    fetch("/api/leaderboard")
      .then(response => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json();
      })
      .then(json => {
        setData(json)
      }).catch(e => {
        console.log(e);
      })
  });

  useEffect(() => {
    fetchData();
  }, []);
  return ( <React.Fragment><h1 className="pb-5 text-center">Leaderboard</h1>
    <div className="row">
    <div className="col-2" ></div>
    <div className="col-8">
      <Table columns={columns} data={data} />

    </div>
    </div>
  </React.Fragment>)
}

export default Leaderboard;