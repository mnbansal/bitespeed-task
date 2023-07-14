const express = require('express');
const mysql = require('mysql2');
const app = express();

app.use(express.json());
const port = process.env.PORT || 8080;

const pool = mysql.createPool({
    host: "mysql_server",
    user: "root",
    password: "admin",
    database: "mydb"
});

app.get("/", (req, res) => {
    res.send("BiteSpeed Task is Ready");
});

app.get("/identify", (req,res) => {
    const query = `
        SELECT *
        FROM Contact
    `;
    pool.query(query, (err,data) => {
        if(data.length === 0){
            return res.send("Contact Table is Empty");
        }else{
            return res.json(data);
        }
    });
});

app.post("/identify", (req,res) => {
    const email = req.body.email;
    const phoneNumber = req.body.phoneNumber;

    if(!email && !phoneNumber){
        return res.status(400).json({error: "Either Email or Phone Number should be provided"});
    }

    const primaryQuery = `
    SELECT *
    FROM Contact
    WHERE (email='${email}' OR phoneNumber='${phoneNumber}') AND linkPrecedence = 'primary'
    ORDER BY createdAt ASC
    `;

    pool.query(primaryQuery, (err,primaryResult) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal Server Error" });
        }

        if(primaryResult.length === 0){
            const createQuery = `
            INSERT INTO Contact (email,phoneNumber,linkPrecedence)
            VALUES ('${email}','${phoneNumber}','primary')
            `;

            pool.query(createQuery, (err,createResult) => {
                if(err){
                    return res.status(500).json({error:"Internal Server Error"});
                }

                const primaryContactId = createResult.insertId;
                return res.status(200).json({
                    contact: {
                        primaryContactId: primaryContactId,
                        emails: [email],
                        phoneNumbers: [phoneNumber],
                        secondaryContactIds: []
                    }
                });
            })
        }else if(primaryResult.length === 1){
            const primaryContact = primaryResult[0];
            const primaryContactId = primaryContact.id;
            const primaryEmail = primaryContact.email;
            const primaryPhoneNumber = primaryContact.phoneNumber;

            if((email && email!=primaryEmail) || (phoneNumber && phoneNumber!=primaryPhoneNumber)){

                const secondaryQuery = `
                    INSERT INTO Contact (email,phoneNumber,linkPrecedence,linkedId)
                    VALUES ('${email}','${phoneNumber}','secondary','${primaryContactId}')
                `;

                pool.query(secondaryQuery, (err,secondaryResult) => {
                    if(err){
                        return res.status(500).json({error:"Internal Server Error"});
                    }
    
                    const secondaryContactId = secondaryResult.insertId;
                    return res.status(200).json({
                        contact: {
                            primaryContactId: primaryContactId,
                            emails: [primaryEmail, email],
                            phoneNumbers: [primaryPhoneNumber, phoneNumber],
                            secondaryContactIds: [secondaryContactId]
                        }
                    });
                });
            }else{
                return res.status(200).json({
                    contact: {
                      primaryContactId: primaryContactId,
                      emails: [primaryEmail],
                      phoneNumbers: [primaryPhoneNumber],
                      secondaryContactIds: []
                    }
                });
            }
        }else if(primaryResult.length > 1){
            const primaryContact = primaryResult[0];
            const updateContact = primaryResult[1];
            const updateContactId = updateContact.id;
            const primaryContactId = primaryContact.id;
            const primaryEmail = primaryContact.email;
            const primaryPhoneNumber = primaryContact.phoneNumber;
            const updateEmail = updateContact.email;
            const updatePhoneNumer = updateContact.phoneNumber;
            
            const updateQuery = `
            UPDATE Contact
            SET linkedId = '${primaryContactId}', linkPrecedence = 'secondary' 
            WHERE id = ${updateContactId}
            `;

            pool.query(updateQuery, (err, updateResult) => {
                if (err) {
                    console.error(primaryErr);
                    return res.status(500).json({ error: "Internal Server Error" });
                }

                return res.status(200).json({
                    contact: {
                        primaryContactId: primaryContactId,
                        emails: [primaryEmail, updateEmail],
                        phoneNumbers: [primaryPhoneNumber, updatePhoneNumer],
                        secondaryContactIds: [updateContactId]
                    }
                });
            });
        }
    });
});

app.listen(port, () => {
    console.log(`BiteSpeed Task API listening on port ${port}`);
});

